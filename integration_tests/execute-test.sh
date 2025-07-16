#!/bin/bash

TEST_TYPE="$1"
MVN_PROFILE=""
case "$TEST_TYPE" in
   "integration") echo "Executing integration tests"
   MVN_PROFILE=integrationTests
   ;;
   "codeReview") echo "Executing code review tests"
   MVN_PROFILE=codeReviewTests
   ;;
   *) echo "specify the test suite to run as integration or codeReview run argument"
     exit 1
   ;;
esac
git config --global --add safe.directory /workspace/app/target/checkout

mvn validate -PinstallCommons

export $(grep -v '^#' .env | xargs)

mvn test -P$MVN_PROFILE