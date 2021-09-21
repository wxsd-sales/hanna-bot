#sudo docker build -t engagement-bot .
#sudo docker run -i -t engagement-bot

#aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin 191518685251.dkr.ecr.us-west-1.amazonaws.com
#docker tag engagement-bot:latest 191518685251.dkr.ecr.us-west-1.amazonaws.com/engagement-bot:latest
#docker push 191518685251.dkr.ecr.us-west-1.amazonaws.com/engagement-bot:latest

#I think this only has to be done 1 time.
#aws ecr create-repository --repository-name engagement-bot

#aws eks --region us-west-1 update-kubeconfig --name bdm-cluster
#kubectl cluster-info

#kubectl apply -f engagement-bot.yaml
#kubectl get ingress -n engagement-bot

#kubectl get pods
#kubectl describe pod <pod name>

FROM node:16.9-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

#overwrite default environment variables
COPY bdm.env .env

CMD [ "npm", "start" ]
