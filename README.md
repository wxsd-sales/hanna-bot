# Hanna Bot

Hanna Bot is a war room assistant bot designed to help with incident response workflows. 

### Setup
You will need to create a file called **.env** that includes the following lines:
```
PORT=
WEBEX_LOG_LEVEL=debug
WEBEX_ACCESS_TOKEN=
MONGO_URI=
MONGO_DB=
ERROR_ROOM_ID=
IMI_PHONE_URL=

```
Note:
1. You will need to provide a port for this to run locally
2. You will need to provide an access_token of a test bot for testing
3. You will need to provide a roomId for error messages to be sent. This can be any Webex Space roomId that your bot is a member of.
4. Please use the Mongo credentials shown above in the .env file
5. Please feel free to add or delete members object in the DB to add or remove members.

### Install
The typical npm install flow, after cloning this repo
```
npm init
npm install
npm start
```
### Usage
1. Send a direct message to the bot created.
2. Bot sends a card, in which you can add your incident ID (optional), select scenario type(required) and also send an additional message(optional)
3. Then click on "Go!" button.
4. A new space creates with the members specified and also sends a SMS message, email and call notifying the members in the group about the incident.
