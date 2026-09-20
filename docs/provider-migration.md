# Praktische Validierung und Providerwechsel

Stand: 19.09.2026. Rekonstruktion anhand der Projektübergabe vom 18.09.2026, `Azure_Fehlschlag_Dokumentation.md`, Implementierung und Screenshots. Der historische Verlauf wird nicht als heute erneut ausgeführter Test dargestellt.

1. **Phase 1:** Azure Static Web Apps Standard, integrierte Functions, Table Storage und Bicep. Die Planung sollte globale statische Auslieferung und wenig Administration verbinden.
2. **Azure V1:** Laut Deploymentdokumentation überschnitten sich die zugelassenen Subscription-Regionen nicht mit den für das Konto verfügbaren Static-Web-Apps-Regionen.
3. **Azure V2:** Umplanung auf Front Door Standard, Storage Static Website, Functions Flex Consumption und Table Storage. Kompilierung, Provider Validation und What-if waren laut Übergabe erfolgreich.
4. **Reale Blockade:** Das Deployment meldete `Free Trial and Student account is forbidden for Azure Frontdoor resources.` Dies ist eine dokumentierte Einschränkung des verwendeten Abonnements. Eine allgemeine Aussage über alle Azure-Konten folgt daraus nicht.
5. **AWS:** CloudFront, privates S3 mit OAC, API Gateway HTTP API, Lambda und DynamoDB wurden mit CloudFormation und dem Plan-/Apply-Ablauf implementiert. Die Screenshots vom 18.09. dokumentieren `UPDATE_COMPLETE` und einen erfolgreichen Write-Smoke-Test.

| Funktion | Phase 1: Azure | Realisiert: AWS |
|---|---|---|
| Globale statische Auslieferung | Static Web Apps | CloudFront und privates S3 |
| HTTP-Backend | Integrierte Functions | API Gateway und Lambda |
| Ergebnisdaten | Table Storage | DynamoDB On-Demand |
| Infrastrukturdefinition | Bicep | CloudFormation |
| Vorschau und Bereitstellung | Azure-Werkzeuge | AWS CLI und aws-publish.py |

Die funktionalen Ziele blieben erhalten. Der Wechsel wurde durch praktische Bereitstellbarkeit begründet. Die AWS-Lösung benötigt mehr explizit konfigurierte Komponenten als die integrierte Ausgangslösung. Sie ist daher kein nachträglicher Beleg, dass die ursprüngliche fachliche Entscheidung falsch gewesen wäre.

**Erkenntnis:** Eine erfolgreiche Vorschau ist ein wichtiger Prüfschritt, garantiert aber kein erfolgreiches Deployment. Ebenso beweisen erfolgreiche Requests weder ein Monats-SLA noch die Tragfähigkeit einer angenommenen Kampagnenspitze.
