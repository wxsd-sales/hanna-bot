require("dotenv").config();
const { MongoClient } = require("mongodb");
var webex = require("webex/env");
let mainCard = require("./cards/hannah.json");
const axios = require("axios");

const mongoUri = `${process.env.MONGO_URI}/${process.env.MONGO_DB}?retryWrites=true&w=majority`;
const mongoClient = new MongoClient(mongoUri);
const mongoDB = process.env.MONGO_DB;
const typeCol = "scenario";
mongoClient.connect((err) => {
  console.log("mongo connection established.");
});

var botId;

function botSetup() {
  webex.people
    .get("me")
    .then(function (person) {
      console.log(person);
      botId = person.id;
      console.log(`Saving BotId:${botId}`);
    })
    .catch(function (reason) {
      console.error(reason);
      process.exit(1);
    });
}

function placeCall(phone, voice_message) {
  let imi_data = { phone_number: phone, message: voice_message };

  axios
    .post(process.env.IMI_PHONE_URL, imi_data)
    .then((response) => {
      console.log("imi init flow launched with data:", response.data);
    })
    .catch((e) => {
      console.log("IMI Send error:");
      console.log(e);
    });
}

function sendLinkViaEmail(
  email,
  meetingLink,
  message,
  notes,
  channel_body,
  subject,
  incident_id
) {
  let msg = `Message: ${message} <br>`;
  if (incident_id != "") {
    msg += `Incident ID: ${incident_id} <br>`;
  }
  if (channel_body != "") {
    msg += `Notes: ${channel_body} <br>`;
  }
  if (notes != "") {
    msg += `Additional Notes: ${notes}  <br>`;
  }
  msg += `Your meeting link: ${meetingLink} <br>`;
  subject = subject + " " + getDateTime();

  const body = { to: email, message: msg, subject: subject };

  axios
    .post(process.env.EMAIL_URL, body)
    .then((response) => {
      console.log("Email sent succesfully:", response.data);
    })
    .catch((e) => {
      console.log("EMAIL Send error:");
      console.log(e);
    });
}

function sendLinkViaSMS(
  phone,
  meetingLink,
  message,
  notes,
  channel_body,
  incident_id
) {
  let msg = `Message: ${message} \n`;
  if (incident_id != "") {
    msg += `Incident ID: ${incident_id} \n`;
  }
  if (channel_body != "") {
    msg += `Notes: ${channel_body} \n`;
  }
  if (notes != "") {
    msg += `Additional Notes: ${notes}  \n`;
  }

  msg += `Your meeting link: ${meetingLink}\n\n`;

  const body = { number: phone, url: msg };

  axios
    .post(process.env.SMS_URL, body)
    .then((response) => {
      console.log("SMS sent succesfully:", response.data);
    })
    .catch((e) => {
      console.log("SMS Send error:");
      console.log(e);
    });
}

function sendWebexMessage(roomId, message, card) {
  let payload = {
    roomId: roomId,
    markdown: message,
  };
  if (card !== undefined) {
    payload.attachments = [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ];
  }
  webex.messages.create(payload).catch((err) => {
    console.log(`error sending message card: ${err}`);
  });
}

function createWebexMembership(payload) {
  return webex.memberships.create(payload).catch(function (reason) {
    console.log(`create membership failed: ${reason}`);
  });
}

function sendMainCard(roomId) {
  scenarioTypes = [];
  mongoClient
    .db(mongoDB)
    .collection(typeCol)
    .find()
    .toArray(function (err, documents) {
      console.log("got scenarioTypes");
      for (let doc of documents) {
        scenarioTypes.push({
          title: doc.scenario_type,
          value: doc.scenario_type,
        });
      }
      mainCard.body[6].choices = scenarioTypes;
      mainCard.body[6].value = scenarioTypes[0]["value"]; //preselect first item as value.  remove this line to default to --select-- placeholder in JSON card.
      sendWebexMessage(
        roomId,
        "Major Incident Request - Adaptive Card",
        mainCard
      );
    });
}

function sendIntroSpaceMessage(roomId, actorId, inputs, message, meetingLink) {
  msg = `<@personId:${actorId}|> has created:  \n`;
  if (inputs.incident_id != "") {
    msg += `>**Incident ID**: ${inputs.incident_id} \n`;
  }
  msg += `>**Scenario**: ${inputs.scenario_type}  \n`;
  msg += `>**Message**: ${message}\n\n`;
  if (inputs.notes != "") {
    msg += `>**Notes**: ${inputs.notes}\n\n`;
  }
  msg += `>**Meeting Link**: ${meetingLink}\n\n`;
  sendWebexMessage(roomId, msg);
}

async function formSubmitted(actorId, inputs) {
  console.log("formSubmitted");
  console.log(inputs);
  let cursor = await mongoClient
    .db(mongoDB)
    .collection(typeCol)
    .aggregate([{ $match: { scenario_type: inputs.scenario_type } }]);
  let doc;
  var licensedLink;
  if (await cursor.hasNext()) {
    doc = await cursor.next();
    console.log("doc:");
    console.log(doc);
    if (inputs.incident_id != "") {
      title =
        inputs.incident_id + " - " + inputs.scenario_type + " " + getDateTime();
    } else {
      title = inputs.scenario_type + " " + getDateTime();
    }
    let roomPayload = { title: title };
    if ([null, undefined, ""].indexOf(doc.team_id) < 0) {
      roomPayload["teamId"] = doc.team_id;
    }

    webex.rooms
      .create(roomPayload)
      .then(function (room) {
        console.log("scenario Type:");
        console.log(inputs.scenario_type);
        for (let i = 1; i <= Object.keys(doc.members).length; i++) {
          createWebexMembership({
            roomId: room.id,
            personEmail: doc.members[i].work_email,
          });
        }

        const body = { expire_hours: 8, sip_target: room.id, version: 2 };

        axios
          .post(process.env.CREATE_URL, body)
          .then((response) => {
            const { data } = response;
            console.log("URL created succesfully:", data);

            console.log(data.urls.Licensed[0]);
            licensedLink = data.urls.Licensed[0];
            default_space_message = doc.default_space_message;
            notifyLink(doc, licensedLink, inputs, default_space_message);
            createWebexMembership({
              roomId: room.id,
              personId: actorId,
            }).then(() => {
              sendIntroSpaceMessage(
                room.id,
                actorId,
                inputs,
                default_space_message,
                licensedLink
              );
            });
          })
          .catch((e) => {
            console.log("URL creation error:");
            console.log(e);
          });
      })
      .catch(function (error) {
        let msg = `formSubmitted Error: failed to create room: ${error}`;
        console.log(msg);
        sendWebexMessage(process.env.ERROR_ROOM_ID, msg);
      });
  } else {
    let msg =
      "formSubmitted Error: mongo aggregate couldn't find an item for that type";
    console.log(msg);
    sendWebexMessage(process.env.ERROR_ROOM_ID, msg);
  }
}

function getDateTime() {
  let date_ob = new Date();
  let date = ("0" + date_ob.getDate()).slice(-2);
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  let year = date_ob.getFullYear();
  let hours = date_ob.getHours();
  let minutes = date_ob.getMinutes();
  let seconds = date_ob.getSeconds();
  let date_time =
    month +
    "/" +
    date +
    "/" +
    year +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;
  return date_time;
}

function notifyLink(doc, meetingLink, inputs, default_space_message) {
  for (let i = 1; i <= Object.keys(doc.notification_channel).length; i++) {
    console.log("LicensedLink", meetingLink);
    if (doc.notification_channel[i].channel_type == "sms") {
      sms_message = doc.notification_channel[i].channel_body;
      for (let i = 1; i <= Object.keys(doc.members).length; i++) {
        sendLinkViaSMS(
          doc.members[i].work_number,
          meetingLink,
          default_space_message,
          inputs.notes,
          sms_message,
          inputs.incident_id
        );
      }
    }
    if (doc.notification_channel[i].channel_type == "call") {
      voice_message = doc.notification_channel[i].channel_body;
      for (let i = 1; i <= Object.keys(doc.members).length; i++) {
        placeCall(doc.members[i].work_number, voice_message);
      }
    }
    if (doc.notification_channel[i].channel_type == "email") {
      email_message = doc.notification_channel[i].channel_body;
      email_subject = doc.notification_channel[i].channel_subject;
      for (let i = 1; i <= Object.keys(doc.members).length; i++) {
        sendLinkViaEmail(
          doc.members[i].work_email,
          meetingLink,
          default_space_message,
          inputs.notes,
          email_message,
          email_subject,
          inputs.incident_id
        );
      }
    }
  }
}

function eventListener() {
  console.log("connected");
  webex.messages
    .listen()
    .then(() => {
      console.log("listening to message events");
      webex.messages.on("created", (message) => {
        if (message.actorId != botId) {
          console.log("message created event:");
          console.log(message);
          let roomId = message.data.roomId;
          sendMainCard(roomId);
        }
      });
    })
    .catch((err) => {
      console.error(`error listening to messages: ${err}`);
    });

  webex.attachmentActions
    .listen()
    .then(() => {
      console.log("listening to attachmentAction events");
      webex.attachmentActions.on("created", (attachmentAction) => {
        console.log("attachmentAction created event:");
        console.log(attachmentAction);
        let messageId = attachmentAction.data.messageId;
        let roomId = attachmentAction.data.roomId;
        let inputs = attachmentAction.data.inputs;
        webex.people.get(attachmentAction.actorId).then((person) => {
          console.log(person);
          if (inputs.submit == "main") {
            if (inputs.scenario_type != "") {
              formSubmitted(attachmentAction.actorId, inputs);
              webex.messages.remove(messageId);
              sendWebexMessage(
                roomId,
                "Thank you for your submission. A new space to discuss your request is being created now."
              );
            } else {
              sendWebexMessage(
                roomId,
                "Please select a scenario and resubmit to continue."
              );
            }
          } else if (inputs.submit == "intro") {
            webex.messages.remove(messageId);
            sendMainCard(roomId);
          }
        });
      });
    })
    .catch((err) => {
      console.error(`error listening to attachmentActions: ${err}`);
    });
}

botSetup();
eventListener();
