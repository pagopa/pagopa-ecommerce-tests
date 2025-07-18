FROM maven:3.9.10-eclipse-temurin-21-alpine AS build
WORKDIR /workspace/app

RUN apk add --no-cache git findutils

COPY ./execute-test.sh ./execute-test.sh
RUN ["chmod" ,"+x" ,"execute-test.sh"]

ENTRYPOINT ["sh", "./execute-test.sh"]