FROM maven:3.9.10-eclipse-temurin-21-alpine@sha256:6e724b043a918ca800383bbeebb9110b3e4709c8c9514d6b792201eb6f9c0439 AS build
WORKDIR /workspace/app

RUN apk add --no-cache git findutils

COPY ./execute-test.sh ./execute-test.sh
RUN ["chmod" ,"+x" ,"execute-test.sh"]

ENTRYPOINT ["sh", "./execute-test.sh"]