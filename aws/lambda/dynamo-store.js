const {DynamoDBClient}=require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  TransactWriteCommand
}=require('@aws-sdk/lib-dynamodb');

const client=DynamoDBDocumentClient.from(new DynamoDBClient({}),{
  marshallOptions:{removeUndefinedValues:true}
});

const partitionFor=rules=>`MODE#${rules==='wrap'?'wrap':'classic'}`;

class DynamoStore{
  constructor(){
    if(!process.env.TABLE_NAME) throw Error('TABLE_NAME missing');
    this.table=process.env.TABLE_NAME;
    this.mode='cloud';
  }

  async top(rules='classic'){
    const result=await client.send(new QueryCommand({
      TableName:this.table,
      KeyConditionExpression:'#pk = :pk AND begins_with(#sk, :score)',
      ExpressionAttributeNames:{'#pk':'pk','#sk':'sk'},
      ExpressionAttributeValues:{':pk':partitionFor(rules),':score':'S#'},
      ScanIndexForward:true,
      Limit:10
    }));
    return (result.Items||[]).map(item=>({
      roundId:item.roundId,
      score:item.score,
      name:item.name,
      createdAt:item.createdAt
    }));
  }

  async add(entry){
    const pk=partitionFor(entry.rules);
    const scoreKey=`S#${String(397-entry.score).padStart(3,'0')}#${entry.roundId}`;
    const receiptKey=`R#${entry.roundId}`;

    try{
      await client.send(new TransactWriteCommand({
        TransactItems:[
          {
            Put:{
              TableName:this.table,
              Item:{pk,sk:scoreKey,type:'score',...entry},
              ConditionExpression:'attribute_not_exists(pk) AND attribute_not_exists(sk)'
            }
          },
          {
            Put:{
              TableName:this.table,
              Item:{pk,sk:receiptKey,type:'receipt',...entry},
              ConditionExpression:'attribute_not_exists(pk) AND attribute_not_exists(sk)'
            }
          }
        ]
      }));
      return {entry,duplicate:false};
    }catch(error){
      if(error.name!=='TransactionCanceledException' && error.name!=='ConditionalCheckFailedException')
        throw error;

      const existing=await client.send(new GetCommand({
        TableName:this.table,
        Key:{pk,sk:receiptKey},
        ConsistentRead:true
      }));

      if(!existing.Item) throw error;
      if(existing.Item.score!==entry.score)
        throw Object.assign(Error('Conflict'),{code:'CONFLICT'});

      return {
        entry:{
          roundId:existing.Item.roundId,
          score:existing.Item.score,
          name:existing.Item.name,
          createdAt:existing.Item.createdAt
        },
        duplicate:true
      };
    }
  }
}

module.exports={DynamoStore};
