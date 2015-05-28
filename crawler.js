var request = require('request');
var redis = require('redis');
var redisClient = redis.createClient('6379', 'redis');
require('log-timestamp');

redisClient.on("error", function (err) {
    console.console.log('Redis Error: ' + err);
});

process.setMaxListeners(100);

function indexDomain(domain) {
    var resp = redisClient.hset([domain, 'indexDate', new Date().toISOString()], function (err, res) {
        if (1 == res) {
            // New domain found
            request({
                method: 'GET',
                uri: domain,
                time: true,
                followRedirect: false,
            }, function (error, response, body) {
                if (!error) {
                    console.log(response.statusCode + ': ' + response.request.uri.href + ' (' + response.elapsedTime + 'ms)');
                }
                if (!error && response.statusCode == 200) {
                    var regex = /(?:(?:ht|f)tp(?:s?)\:\/\/)(?:(?:[-\w]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|museum|travel|[a-z]{2}))/gi
                    var result = body.match(regex);

                    foundUrls = 0;
                    if (result) {
                        foundUrls = result.length
                    }

                    multi = redisClient.multi();
                    // Add metadata
                    multi.hset([domain, 'responseTime', response.elapsedTime]);
                    multi.hset([domain, 'responseStatus', response.statusCode]);
                    multi.hset([domain, 'realHref', response.request.uri.href ]);
                    multi.hset([domain, 'urlsFound', foundUrls]);

                    // @todo: Filter duplicates
                    for (var id in result) {
                        multi.rpush('domainsToIndex', result[id]);
                    }

                    multi.exec(function (err, replies) {
                        if (err) {
                            console.log('Error adding domain to list: ' + err);
                        }
                    });
                }
                fetchDomain();
            });
        } else {
            fetchDomain();
        }
    });
}

function fetchDomain() {

    // fetch next from Redis
    redisClient.lpop('domainsToIndex', function (err, reply) {
        if (err) {
            console.log('Error: ' + err);
            return false;
        }
        if (reply) {
            indexDomain(reply.toString());
        } else {
            indexDomain('http://www.nu.nl/');
        }
    });
}

console.log('Starting crawler..');
fetchDomain();
