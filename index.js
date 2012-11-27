"use strict";

var express = require('express'),
	fs = require('fs'),
	when = require('when'),
	request = require('superagent'),
	leveldb = require('leveldb');

var app = express(),
	db,
	apiBaseUrl = 'http://ex.fm/api/v3';

app.get('/api/v3/user/:user/loved', function(req, res){
	var start = parseInt(req.query.start, 10) || 0,
		results = parseInt(req.query.results, 10) || 20,
		username = req.params.user;

	db.get(username, function(err, data){
		if (data === null){
			return getLoveData(username).then(function(userLoves){
				res.statusCode = 200;
				return res.json(parseLoves(userLoves, start, results));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown user " + username + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(parseLoves(JSON.parse(data), start, results));
	});
});

app.get('/api/v3/user/:user/loved_ids', function(req, res){
	var username = req.params.user;
	db.get(username + ':loved_ids', function(err, data){
		if (data === null){
			return getLoveIds(username).then(function(userLoveIds){
				res.statusCode = 200;
				return res.json(parseLoveIds(userLoveIds));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown user " + username + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(parseLoveIds(JSON.parse(data)));
	});
});

leveldb.open(__dirname + '/fakedata.db', { create_if_missing: true }, function(err, data){
	console.log('server running.');
	console.log('database connected.');
	db = data;
	app.listen(8088);
});

function parseLoves(userLoves, start, results){
	var songs;
	console.log(userLoves.length);
	if (start + results > userLoves.length){
		songs = userLoves.slice(start, userLoves.length);
	}
	else {
		songs = userLoves.slice(start, start + results);
	}
	return {
		'status_test': "OK",
		'status_code': 200,
		'results': songs.length,
		'start': start,
		'total': userLoves.length,
		'songs': songs
	};
}

function parseLoveIds(userLoveIds){
	return {
		'status_test': "OK",
		'status_code': 200,
		'total': userLoveIds.length,
		'song_ids': userLoveIds
	};
}

function getLoveData(username){
    var d = when.defer(),
        resultsSet = [],
        resultsSize = 100,
        start = 0,
        startArray= [],
        path = apiBaseUrl + '/user/' + username + '/loved';
    request
        .get(path)
        .query({
            'start': 0,
            'results': 100
        })
        .end(function(res){
            var total = res.body.total,
                i;
            if (res.statusCode !== 200){
                return d.reject();
            }
            if (total > resultsSize){
                resultsSet = resultsSet.concat(res.body.songs);
                for (i = start + resultsSize; i < total; i = i + resultsSize){
                    startArray.push(i);
                }
                return when.all(startArray.map(function(startVal){
                    var p = when.defer();
                    request
                        .get(path)
                        .query({
                            'start': startVal,
                            'results': resultsSize
                        })
                        .end(function(res){
                            if (res.statusCode !== 200){
                                return p.reject();
                            }
                            resultsSet = resultsSet.concat(res.body.songs);
                            return p.resolve();
                        });
                    return p.promise;
                })).then(function(){
                    d.resolve(insertIntoDB(username, resultsSet));
                });
            }
            resultsSet = resultsSet.concat(res.body.songs);
            d.resolve(insertIntoDB(username, resultsSet));
        });
    return d.promise;
}

function getLoveIds(username){
    var d = when.defer(),
		path = apiBaseUrl + '/user/' + username + '/loved_ids';
     request
        .get(path)
        .end(function(res){
            if (res.statusCode !== 200){
                return d.reject();
            }
            return d.resolve(insertIntoDB(username+':loved_ids', res.body.song_ids));
        });
    return d.promise;
}

function insertIntoDB(key, results){
	var d = when.defer();
	db.put(key, JSON.stringify(results), function(err){
		return d.resolve(results);
	});
	return d.promise;
}
