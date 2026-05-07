#!/bin/bash

cd db-dev

docker compose down -v && yes | docker system prune && docker compose up -d
