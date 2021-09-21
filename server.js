require('dotenv').config();
const {MongoClient} = require('mongodb');
var webex = require('webex/env');
let mainCard = require('./cards/main.json');

const mongoUri =`${process.env.MONGO_URI}/${process.env.MONGO_DB}?retryWrites=true&w=majority`
const mongoClient = new MongoClient(mongoUri);
const mongoDB = process.env.MONGO_DB;
const typeCol = "type";
mongoClient.connect(err => { console.log('mongo connection established.') });

var botId;

function botSetup(){
  webex.people.get("me").then(function(person){
      console.log(person);
      botId = person.id;
      console.log(`Saving BotId:${botId}`);
  }).catch(function(reason) {
      console.error(reason);
      process.exit(1);
  });
}

function sendWebexMessage(roomId, message, card){
  let payload = {
                 "roomId":roomId,
                 "markdown":message
                }
  if(card !== undefined){
    payload.attachments = [
      {
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": card
      }
    ]
  }
  webex.messages.create(payload).catch((err) => {
    console.log(`error sending message card: ${err}`);
  })
}

function createWebexMembership(payload){
  return webex.memberships.create(payload)
    .catch(function(reason){
      console.log(`create membership failed: ${reason}`);
    });
}

function sendMainCard(roomId){
  engagementTypes = [];
  mongoClient.db(mongoDB).collection(typeCol).find().toArray(function(err, documents) {
    console.log('got engagementTypes');
    for(let doc of documents){
      engagementTypes.push({"title": doc.type, "value": doc.type});
    }
    mainCard.body[10].choices = engagementTypes;
    mainCard.body[10].value = engagementTypes[0]["value"]; //preselect first item as value.  remove this line to default to --select-- placeholder in JSON card.
    sendWebexMessage(roomId, "Engagement Request Form - Adaptive Card", mainCard);
  });
}

function sendIntroSpaceMessage(roomId, actorId, inputs, links){
  msg = `<@personId:${actorId}|> has requested assistance with:  \n`;
  //normally I should probably iterate over these keys but they look uglier that way and I like this specific order.
  msg += `>**Engagement Type**: ${inputs.engagement_type}  \n`;
  msg += `>**Customer Name**: ${inputs.customer_name}  \n`;
  msg += `>**Geography**: ${inputs.geography}  \n`;
  msg += `>**Sales Level 2**: ${inputs.sales_level_2}  \n`;
  msg += `>**Sales Level 3**: ${inputs.sales_level_3}  \n`;
  msg += `>**Additional Comments**: ${inputs.comments}\n\n`;
  msg += 'An expert will follow up with you in this space as soon as possible. In the mean time, here are a few helpful links:  \n';
  for(let link of links){
    console.log(link);
    msg += `[${link.name}](${link.url})  \n`;
  }
  sendWebexMessage(roomId, msg);
}

async function formSubmitted(actorId, inputs){
  console.log('formSubmitted');
  console.log(inputs);
  //let doc = await mongoClient.db(mongoDB).collection(typeCol).findOne({"type":inputs.engagement_type});
  let cursor = await mongoClient.db(mongoDB).collection(typeCol).aggregate([
                {$match : {type:inputs.engagement_type} },
                {$lookup :
                          {from :"links" ,
                           localField : "links",
                           foreignField:"_id" ,
                           as :"links"}
                }
              ]);
  let doc;
  if (await cursor.hasNext()) {
    doc = await cursor.next();
    console.log('doc:');
    console.log(doc);
    let roomPayload = {"title":`COE Engagement: ${inputs.customer_name} - ${doc.short_name}` };
    if([null, undefined, ""].indexOf(doc.team_id) < 0){
      roomPayload["teamId"] = doc.team_id;
    }
    webex.rooms.create(roomPayload)
      .then(function(room){
        console.log("Engagement Type:");
        console.log(inputs.engagement_type);
        for(let pers of doc.people){
          console.log(pers);
          createWebexMembership({"roomId":room.id, "personEmail":pers});
        }
        createWebexMembership({"roomId":room.id, "personId":actorId}).then(() => {
          sendIntroSpaceMessage(room.id, actorId, inputs, doc.links);
        });
      }).catch(function(error){
        console.log(`formSubmitted Error: failed to create room: ${error}`);
      });
  } else {
    console.log("formSubmitted Error: mongo aggregate couldn't find an item for that type");
  }
}

function eventListener(){
  console.log('connected');
  webex.messages.listen()
    .then(() => {
      console.log('listening to message events');
      webex.messages.on('created', (message) => {
        if(message.actorId != botId){
          console.log('message created event:');
          console.log(message);
          let roomId = message.data.roomId;
          sendMainCard(roomId);
        }//else, we do nothing when we see the bot's own message
      });
    })
    .catch((err) => {
      console.error(`error listening to messages: ${err}`);
    });

  webex.attachmentActions.listen()
    .then(() => {
      console.log('listening to attachmentAction events');
      webex.attachmentActions.on('created', (attachmentAction) => {
        console.log('attachmentAction created event:');
        console.log(attachmentAction);
        let messageId = attachmentAction.data.messageId;
        let roomId = attachmentAction.data.roomId;
        let inputs = attachmentAction.data.inputs;
        if(inputs.submit == 'main'){
          if(inputs.customer_name != ''){
            formSubmitted(attachmentAction.actorId, inputs);
            webex.messages.remove(messageId);
            sendWebexMessage(roomId, "Thank you for your submission. A new space to discuss your request is being created now.");
          } else {
            sendWebexMessage(roomId, "Please enter a customer name and resubmit to continue.");
          }
        } else if(inputs.submit == 'intro'){
          webex.messages.remove(messageId);
          sendMainCard(roomId);
        }
      });
    })
    .catch((err) => {
      console.error(`error listening to attachmentActions: ${err}`);
    });
}

botSetup();
eventListener();
