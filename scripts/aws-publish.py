"""Safe preview/deployment helper for the IU Snake AWS architecture."""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

APP=Path(__file__).resolve().parents[1]

def run(args,label,cwd=APP,capture=True):
    print(label,flush=True)
    result=subprocess.run(args,cwd=cwd,text=True,capture_output=capture)
    if result.returncode:
        detail=(result.stderr or result.stdout or '').strip()
        if len(detail)>2500:
            detail=detail[:2500]+'...'
        raise RuntimeError(f'{label} fehlgeschlagen (Exit {result.returncode}).\n{detail}')
    return result.stdout if capture else ''

def aws(config,args,label):
    return run([
        'aws',*args,
        '--profile',config['profile'],
        '--region',config['region'],
        '--output','json'
    ],label)

def validate_config(config):
    today=date.today()
    required=['profile','region','stackName','projectName','creditCheckedOn',
              'creditRemainingUsd','plannedSpendUsd','freePlanExpiresOn']
    if any(key not in config for key in required):
        raise ValueError('AWS-Konfiguration unvollständig.')
    checked=date.fromisoformat(config['creditCheckedOn'])
    expires=date.fromisoformat(config['freePlanExpiresOn'])
    if not re.fullmatch(r'[A-Za-z0-9+=,.@_-]{1,64}',config['profile']):
        raise ValueError('Ungültiger Profilname.')
    if config['region']!='eu-central-1':
        raise ValueError('Für dieses Projekt ist eu-central-1 vorgesehen.')
    if not re.fullmatch(r'[a-zA-Z][-a-zA-Z0-9]{0,127}',config['stackName']):
        raise ValueError('Ungültiger Stackname.')
    if not re.fullmatch(r'[a-z0-9-]{3,32}',config['projectName']):
        raise ValueError('Ungültiger Projektname.')
    if not (0 <= (today-checked).days <= 1):
        raise ValueError('Guthabenprüfung ist älter als einen Tag.')
    if expires <= today:
        raise ValueError('AWS Free Plan ist laut Konfiguration abgelaufen.')
    if not isinstance(config['plannedSpendUsd'],(int,float)) or not 0 < config['plannedSpendUsd'] <= 10:
        raise ValueError('plannedSpendUsd muss zwischen 0 und 10 USD liegen.')
    if config['creditRemainingUsd'] < config['plannedSpendUsd'] + 30:
        raise ValueError('Mindestens 30 USD Sicherheitsreserve erforderlich.')

def identity(config):
    info=json.loads(aws(config,['sts','get-caller-identity'],'AWS-Identität prüfen'))
    arn=info.get('Arn','')
    if ':root' in arn:
        raise RuntimeError('Sicherheitsstopp: Root-Identität ist für das Deployment nicht erlaubt.')
    if not arn.endswith(':user/iu-cloud-admin'):
        raise RuntimeError(f'Unerwartete AWS-Identität: {arn}')
    return info

def stack_state(config):
    result=subprocess.run([
        'aws','cloudformation','describe-stacks',
        '--stack-name',config['stackName'],
        '--profile',config['profile'],
        '--region',config['region'],
        '--output','json'
    ],cwd=APP,text=True,capture_output=True)
    if result.returncode:
        return None
    return json.loads(result.stdout)['Stacks'][0]['StackStatus']

def make_lambda_zip(target):
    source=APP/'aws'/'lambda'
    if not (source/'node_modules').exists():
        raise RuntimeError('aws/lambda/node_modules fehlt. Zuerst npm install --prefix aws/lambda ausführen.')
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
        for path in source.rglob('*'):
            if path.is_file() and path.name!='.DS_Store':
                archive.write(path,path.relative_to(source).as_posix())

def plan(config):
    state=stack_state(config)
    change_type='CREATE' if state is None or state=='REVIEW_IN_PROGRESS' else 'UPDATE'
    change_name=f"{config['stackName']}-plan"

    # Remove an older unexecuted change set with the same stable name.
    subprocess.run([
        'aws','cloudformation','delete-change-set',
        '--stack-name',config['stackName'],
        '--change-set-name',change_name,
        '--profile',config['profile'],
        '--region',config['region']
    ],cwd=APP,capture_output=True,text=True)

    args=[
        'cloudformation','create-change-set',
        '--stack-name',config['stackName'],
        '--change-set-name',change_name,
        '--change-set-type',change_type,
        '--template-body','file://infra/aws/template.yaml',
        '--parameters',f"ParameterKey=ProjectName,ParameterValue={config['projectName']}",
        '--capabilities','CAPABILITY_NAMED_IAM',
        '--description','IU Snake reviewed deployment plan'
    ]
    created=json.loads(aws(config,args,'CloudFormation Change Set erstellen (noch keine Ressourcen)'))
    change_id=created['Id']

    wait=run([
        'aws','cloudformation','wait','change-set-create-complete',
        '--change-set-name',change_id,
        '--profile',config['profile'],
        '--region',config['region']
    ],'Auf vollständige Änderungsvorschau warten')

    described=json.loads(aws(config,[
        'cloudformation','describe-change-set','--change-set-name',change_id
    ],'CloudFormation Änderungsvorschau abrufen'))

    path=APP/'aws-plan.local.json'
    path.write_text(json.dumps(described,indent=2)+'\n')

    print('\nGeplante Änderungen:')
    for change in described.get('Changes',[]):
        rc=change.get('ResourceChange',{})
        print(f"  {rc.get('Action','?'):8} {rc.get('ResourceType','?'):45} {rc.get('LogicalResourceId','?')}")
    print(f'\nPlan gespeichert: {path}')
    print('Noch NICHT bereitgestellt.')

def apply(config):
    plan_path=APP/'aws-plan.local.json'
    if not plan_path.exists():
        raise RuntimeError('Kein geprüfter aws-plan.local.json vorhanden. Zuerst --plan ausführen.')
    plan_data=json.loads(plan_path.read_text())
    change_id=plan_data.get('ChangeSetId') or plan_data.get('ChangeSetName')
    if not change_id:
        raise RuntimeError('Gespeicherter Change Set ist ungültig.')

    # `describe-change-set` liefert keinen verlässlichen ChangeSetType-Wert.
    # Bei einem neuen CREATE-Change-Set befindet sich der Stack in REVIEW_IN_PROGRESS.
    # Bei späteren Änderungen ist der Stack bereits erstellt und benötigt den UPDATE-Waiter.
    state=stack_state(config)
    if state=='REVIEW_IN_PROGRESS':
        waiter='stack-create-complete'
    elif state in {
        'CREATE_COMPLETE','UPDATE_COMPLETE','UPDATE_ROLLBACK_COMPLETE',
        'IMPORT_COMPLETE','IMPORT_ROLLBACK_COMPLETE'
    }:
        waiter='stack-update-complete'
    else:
        raise RuntimeError(
            f'Unerwarteter Stack-Status vor Deployment: {state}. '
            'Change Set nicht ausgeführt.'
        )

    identity(config)
    aws(config,[
        'cloudformation','execute-change-set','--change-set-name',change_id
    ],'Geprüften CloudFormation Change Set ausführen')

    run([
        'aws','cloudformation','wait',waiter,
        '--stack-name',config['stackName'],
        '--profile',config['profile'],
        '--region',config['region']
    ],'Auf CloudFormation-Bereitstellung warten')

    stack=json.loads(aws(config,[
        'cloudformation','describe-stacks','--stack-name',config['stackName']
    ],'Stack-Ausgaben abrufen'))
    outputs={item['OutputKey']:item['OutputValue']
             for item in stack['Stacks'][0].get('Outputs',[])}

    run(['npm','ci','--prefix','aws/lambda','--omit=dev','--ignore-scripts'],
        'Lambda-Abhängigkeiten reproduzierbar installieren')

    with tempfile.TemporaryDirectory(prefix='iu-snake-lambda-') as directory:
        package=Path(directory)/'lambda.zip'
        make_lambda_zip(package)
        aws(config,[
            'lambda','update-function-code',
            '--function-name',outputs['FunctionName'],
            '--zip-file',f'fileb://{package}'
        ],'Lambda-Anwendungscode veröffentlichen')
        run([
            'aws','lambda','wait','function-updated-v2',
            '--function-name',outputs['FunctionName'],
            '--profile',config['profile'],
            '--region',config['region']
        ],'Auf Lambda-Aktualisierung warten')

    run([
        'aws','s3','sync','public',f"s3://{outputs['SiteBucketName']}",
        '--delete',
        '--exclude','staticwebapp.config.json',
        '--exclude','.DS_Store',
        '--profile',config['profile'],
        '--region',config['region']
    ],'Frontend in privaten S3-Bucket hochladen',capture=False)

    invalidation=json.loads(aws(config,[
        'cloudfront','create-invalidation',
        '--distribution-id',outputs['DistributionId'],
        '--paths','/*'
    ],'CloudFront Cache invalidieren'))

    result={
        'stackName':config['stackName'],
        'region':config['region'],
        'publicUrl':outputs['PublicUrl'],
        'distributionId':outputs['DistributionId'],
        'functionName':outputs['FunctionName'],
        'scoresTableName':outputs['ScoresTableName'],
        'siteBucketName':outputs['SiteBucketName'],
        'invalidationId':invalidation['Invalidation']['Id']
    }
    (APP/'aws-deployment-result.local.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f"\nBereitgestellt: {outputs['PublicUrl']}")
    print('CloudFront kann einige Minuten benötigen, bevor alle Edge-Standorte den neuen Stand ausliefern.')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',type=Path,default=APP/'aws-deployment.local.json')
    actions=parser.add_mutually_exclusive_group()
    actions.add_argument('--plan',action='store_true')
    actions.add_argument('--apply',action='store_true')
    args=parser.parse_args()

    try:
        config=json.loads(args.config.read_text())
        validate_config(config)
        identity(config)

        if args.apply:
            apply(config)
        elif args.plan:
            plan(config)
        else:
            print(f"Ziel: {config['stackName']} / {config['region']}; "
                  "CloudFront + private S3 + HTTP API + Lambda + DynamoDB.")
            print('Konfiguration und Nicht-Root-Identität gültig. Keine Ressourcen erstellt.')
        return 0
    except (OSError,ValueError,RuntimeError,json.JSONDecodeError) as error:
        print(str(error),file=sys.stderr)
        return 1

if __name__=='__main__':
    sys.exit(main())
