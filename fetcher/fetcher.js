'use strict';

var request = require('request');
var elasticsearch = require('elasticsearch');
var esClient = new elasticsearch.Client({
    host: 'elasticsearch:9200',
    //    log: 'trace'
});
var rabbitMqContext;

// process.setMaxListeners(100);

function indexDomain(domain, callback) {
    // @todo: Check for duplicates
    request({
        method: 'GET',
        uri: domain,
        time: true,
        followRedirect: false,
        timeout: 1000
    }, function (error, response, body) {
        if (!error) {
            console.log(response.statusCode + ': ' + response.request.uri.href + ' (' + response.elapsedTime + 'ms)');
        }
        if (!error && response.statusCode == 200) {
            esClient.index({
                index: 'domains',
                type: 'domain',
                id: domain,
                body: {
                    doc: {
                        responseTime: response.elapsedTime,
                        responseCode: response.statusCode,
                        realHref: response.request.uri.href,
                        indexDate: new Date().toISOString(),
                        indexed: true
                    }
                }
            }, function (err, res) {
                if (err) {
                    console.log('ES error: ' + err);
                    callback();
                    return;
                }
                var publisher = rabbitMqContext.socket('PUSH', {persistent: 1});
                publisher.connect('crawler', function () {
                    publisher.write(JSON.stringify({ domain: domain, body: body}), 'utf8');
                    callback();
                });
            });

        } else {
            callback();
        }
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
        worker.connect('domains', function () {
            worker.on('data', function (payload) {
                var data  = JSON.parse(payload);
                indexDomain(data.domain, function () {
                    worker.ack();
                });
            });
        });
    });
}

function startFetcher() {
    esClient.ping({
        requestTimeout: 30000
    }, function (error, response) {
        if (error) {
            console.log('Connection to Elasticsearch failed, retrying in 2 seconds..');
            setTimeout(startFetcher, 2000);
        } else {
            console.log('Elasticsearch is ready.');
            startWorker()
        }
    });
}
startFetcher();

