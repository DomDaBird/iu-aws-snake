const {handle}=require('./handler');
const {DynamoStore}=require('./dynamo-store');

let store;

function normalizedHeaders(headers={}){
  return Object.fromEntries(
    Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value])
  );
}

exports.handler=async event=>{
  try{
    store ||= new DynamoStore();

    const rawBody=event.body
      ? (event.isBase64Encoded?Buffer.from(event.body,'base64').toString('utf8'):event.body)
      : '';

    const req={
      method:event.requestContext?.http?.method||'GET',
      query:event.queryStringParameters||{},
      headers:normalizedHeaders(event.headers||{}),
      rawBody,
      body:rawBody
    };

    const result=await handle(req,store);

    return {
      statusCode:result.status,
      headers:result.headers,
      body:JSON.stringify(result.body)
    };
  }catch(error){
    console.error('Leaderboard backend unavailable',error?.name||'Error');
    return {
      statusCode:503,
      headers:{
        'Content-Type':'application/json',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'
      },
      body:JSON.stringify({error:'Bestenliste vorübergehend nicht verfügbar.'})
    };
  }
};
