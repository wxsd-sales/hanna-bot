# EngagementBot

### Setup
You will need to create a file called **.env** that includes the following lines:
```
PORT=
WEBEX_LOG_LEVEL=debug
WEBEX_ACCESS_TOKEN=
MONGO_URI="mongodb+srv://engagementbotdev:z1opfzPemoK7mJEe@democluster.a5pbd.mongodb.net"
MONGO_DB=engagementBotDev
SMARTSHEET_ACCESS_TOKEN=QG75LCy1aA7OnKGiCGtIWHFtO9ktWGOb1AM2G
ERROR_ROOM_ID=
```
Note:
1. You will need to provide a port for this to run locally
2. You will need to provide an access_token of a test bot for testing
3. You will need to provide a roomId for error messages to be sent. This can be any Webex Space roomId that your bot is a member of.
4. Please use the SMARTSHEET_ACCESS_TOKEN shown above in the .env file
5. Please use the Mongo credentials shown above in the .env file
6. The engagementBotDev DB can be altered freely for testing (please do not include test data in the production DB, called engagementBot)

**Important**  
The file **bdm.env** is for the production version of the bot.  Please do not change the values in that file unless it is required.

### Install
The typical npm install flow, after cloning this repo
```
npm init
npm install
npm start
```

To deploy this in production, please use the build/push commands commented in the Dockerfile.
