# EngagementBot

### Setup
You will need to create a file called **.env** that includes the following lines:
```
PORT=
WEBEX_LOG_LEVEL=debug
WEBEX_ACCESS_TOKEN=
MONGO_URI="mongodb+srv://engagementbot:WUxN0muMJPNxyLWa@wxsdsmall.p9xng.mongodb.net"
MONGO_DB=engagementBotDev
```
Note:
1. You will need to provide a port for this to run locally
2. You will need to provide an access_token of a test bot for testing
3. Please use the Mongo credentials shown above in the .env file
4. The engagementBotDev DB can be altered freely for testing (please do not include test data in the production DB, called engagementBot)

**Important**  
The file **bdm.env** is for the production version of the bot.  Please do not change the values in that file unless it is required.

### Install
The typical npm install flow, after cloning this repo
```
npm init
npm install
npm start
```
