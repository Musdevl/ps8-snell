#!/bin/bash

# run with arg prod or dev depending on the environnement
# ex: ./shutdown-dockers prod                       for a prod environnement
# ex: ./shutdown-dockers dev                        for a dev environnement

docker compose -f docker-compose-$1.yml down && cd db-dev && docker compose down &&  yes
