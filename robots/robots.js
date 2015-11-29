'use strict';

var request = require('request');
var elasticsearch = require('elasticsearch');
var esClient = new elasticsearch.Client({
    host: 'elasticsearch:9200',
    //    log: 'trace'
});
require('log-timestamp');
function indexRobots(domain) {
    var url = domain + "robots.txt";
    console.log('Fetching ' + url);
    request({
        method: 'GET',
        uri: url ,
        time: true,
        followRedirect: false,
    }, function (error, response, body) {
        var statusCode = 500;
        var elapsedTime = 0;
        if (!error) {
            statusCode = response.statusCode;
            elapsedTime = response.elapsedTime;
        }

        console.log(statusCode + ': ' + domain + ' (' + elapsedTime + 'ms)');

        // @todo: parse robots.txt
        esClient.update({
            index: 'domains',
            type: 'domain',
            id: domain,
            body: {
                doc: {
                    robots: {
                        responseTime: elapsedTime,
                        responseCode: statusCode,
                        body: body,
                        indexed: true
                    }
                }
            }
        }).then(function(response) {
            fetchNextDomain();
        });
    });
}

function fetchNextDomain() {
    esClient.search({
        index: 'domains',
        type: 'domain',
        size: 1,
        sort: 'indexDate:asc',
        body: {
            query: {
                filtered: {
                    filter: {
                        bool: {
                            must: [
                                {
                                    term: {
                                        indexed: true
                                    }
                                }
                            ],
                            must_not: [
                                {
                                    term: {
                                        'robots.indexed': true
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    }, function (error, response) {
        if (error) {
            console.log('ES error: ' + error);
            return;
        }
        if (response.hits.total > 0) {
            indexRobots(response.hits.hits[0]['_id']);
        } else {
            // Start fresh?
        }
    });
}

function startRobots() {
    esClient.ping({
        requestTimeout: 30000,
    }, function (error, response) {
        if (error) {
            console.log('Connection failed, retrying in 2 seconds..');
            setTimeout(startRobots, 2000);
        } else {
            console.log('Starting robots..');
            fetchNextDomain();
        }
    });
}
console.log('Waiting for Elasticsearch..');
startRobots();
