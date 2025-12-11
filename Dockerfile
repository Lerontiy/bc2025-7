# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.20.0
FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV production
WORKDIR /usr/src/app
# RUN npm install -g nodemon
#COPY package.json package-lock.json ./
#RUN npm ci
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci
#RUN chown -R node:node /usr/src/app
USER node
COPY . .
EXPOSE 3000
CMD npm run dev
