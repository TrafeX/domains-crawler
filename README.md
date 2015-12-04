Domains Crawler
================
An experiment to generate a database with domains found on websites.

Powered by NodeJS, RabbitMQ, Elasticsearch & Docker(-compose).

Usage
=====

Requirements
------------

- Docker & pip
`sudo apt-get install docker-engine python-pip`

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

(Re)build the docker containers
-------------------------------
`sudo docker-compose build`


TODO
====

Domain > Fetch > Domain document & body > Crawler > Domain

- Fetcher: Request url, create document with response code & timing. Add body to queue.
- Crawler: Fetch body from queue, search urls, add to queue & add foundurls to document.

Starting
========

* Go to the RabbitMQ interface: http://localhost:15672/ (u: guest, p: guest)
* Go to the 'domains' queue
* Publish the following message:
        
        { "domain": "http://www.nu.nl" }
