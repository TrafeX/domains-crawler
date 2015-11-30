'use strict';

var request = require('request');
var redis = require('redis');
var elasticsearch = require('elasticsearch');
var esClient = new elasticsearch.Client({
    host: 'elasticsearch:9200',
    //    log: 'trace'
});
var redisClient = redis.createClient('6379', 'redis');
require('log-timestamp');

redisClient.on("error", function (err) {
    console.log('Redis Error: ' + err);
});

process.setMaxListeners(100);

function indexDomain(domain) {
    esClient.index({
        index: 'domains',
        type: 'domain',
        id: domain,
        body: {
            indexDate: new Date().toISOString(),
            indexed: true
        }
    }, function (err, res) {
        if (err) {
            console.log('ES error: ' + err);
            return;
        }

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
                var regex = /(?:(?:ht|f)tp(?:s?)\:\/\/)(?:(?:[-\w]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|museum|travel|[a-z]{2}))/gi;
                var result = body.match(regex);

                var foundUrls = 0;
                if (result) {
                    var domains = result.filter(function(elem, pos) {
                        return result.indexOf(elem) == pos;
                    });
                    foundUrls = domains.length
                }

                esClient.update({
                    index: 'domains',
                    type: 'domain',
                    id: domain,
                    body: {
                        doc: {
                            responseTime: response.elapsedTime,
                            responseCode: response.statusCode,
                            realHref: response.request.uri.href,
                            urlsFound: foundUrls,
                        }
                    }
                });

                // @todo: var multi = redisClient.multi();

                for (var id in domains) {
                    addDomainToIndex(domains[id]);
                }
            }
            fetchDomain();
        });
    });
}

function addDomainToIndex(domain) {

    redisClient.sismember('domains', domain, function (err, reply) {
        if (err) {
            console.log('Redis error: ' + err);
            return;
        }
        if (reply === 0) {
            redisClient.rpush('domainsToIndex', domain);
            redisClient.sadd('domains', domain);
        }
    });
}


function fetchDomain() {
    redisClient.lpop('domainsToIndex', function (err, reply) {
        if (err) {
            console.log('Error: ' + err);
            return false;
        }
        if (reply) {
            indexDomain(reply.toString());
        } else {
            indexDomain('http://www.nu.nl');
        }
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
            fetchDomain();
        }
    });
}
console.log('Waiting for Elasticsearch..');
startCrawler();

