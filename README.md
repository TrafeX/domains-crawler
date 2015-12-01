Domains Crawler
================
An experiment to generate a database with domains found on websites.

Powered by NodeJS, Redis & Docker(-compose).

Usage
=====

Requirements
------------

- Docker & pip
`sudo apt-get install docker.io python-pip`

- Docker-compose
`sudo pip install -U docker-compose`

Start
-----
`sudo docker-compose up -d`

Scale
-----
`sudo docker-compose scale crawler=4`

See the output
--------------
`sudo docker-compose logs`

Login to Redis
--------------
`sudo docker run -it --link domainscrawler_redis_1:redis --rm redis sh -c 'exec redis-cli -h "$REDIS_PORT_6379_TCP_ADDR" -p "$REDIS_PORT_6379_TCP_PORT"'`

(Re)build the docker containers
-------------------------------
`sudo docker-compose build`


TODO
====


Domain > Fetch > Domain document & body > Crawler > Domain

- Fetcher: Request url, create document with response code & timing. Add body to queue.
- Crawler: Fetch body from queue, search urls, add to queue & add foundurls to document.

