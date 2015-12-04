'use strict';

var request = require('request');
var elasticsearch = require('elasticsearch');
var esClient = new elasticsearch.Client({
    host: 'elasticsearch:9200',
    //    log: 'trace'
});
var rabbitMqContext;

function crawlDomain(domain, body, responseTime, callback) {
    var regex = /(?:(?:ht|f)tp(?:s?)\:\/\/)(?:(?:[-\w]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|museum|travel|[a-z]{2}))/gi;
    var result = body.match(regex);

    var foundUrls = 0;
    if (result) {
        var domains = result.filter(function(elem, pos) {
            return result.indexOf(elem) == pos;
        });
        foundUrls = domains.length
    }

    console.log('Found %s domains on %s', foundUrls, domain);

    // @todo: Check for duplicates
    esClient.index({
        index: 'domains',
        type: 'domain',
        id: domain,
        body: {
            doc: {
                responseTime: responseTime,
                indexDate: new Date().toISOString(),
                indexed: true,
                urlsFound: foundUrls
            }
        }
    }, function (err, res) {

        if (err) {
            console.log('ES error: ' + err);
            callback();
            return;
        }

        var publisher = rabbitMqContext.socket('PUSH', {persistent: 1});

        publisher.connect('domains', function () {
            for (var id in domains) {
                publisher.write(JSON.stringify({ domain: domains[id]}), 'utf8');
            }
            callback();
        });
    });
}

function startWorker() {
    rabbitMqContext = require('rabbit.js').createContext('amqp://rabbitmq');

    rabbitMqContext.on('error', function(error) {
        console.log('Connection to RabbitMQ failed (%s), retrying in 2 seconds..', error);
        setTimeout(startWorker, 2000);
    });

    rabbitMqContext.on('ready', function() {
        console.log('RabbitMQ context is ready');
        var worker = rabbitMqContext.socket('WORKER', {prefetch: 1, persistent: 1});
        worker.connect('crawler', function () {
            worker.on('data', function (payload) {
                var data  = JSON.parse(payload);
                crawlDomain(data.domain, data.body, data.responseTime, function() {
                    worker.ack();
                });
            });
        });
    });
}

function startCrawler() {
    esClient.ping({
        requestTimeout: 30000,
    }, function (error, response) {
        if (error) {
            console.log('Connection failed, retrying in 2 seconds..');
            setTimeout(startCrawler, 2000);
        } else {
            console.log('Starting crawler..');
            startWorker();
        }
    });
}
console.log('Waiting for Elasticsearch..');
startCrawler();

