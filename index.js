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
	var start = req.query.start || 0,
		results = req.query.results || 20,
		username = req.params.user;

	db.get(username, function(err, data){
		if (data === null){
			return getData(username).then(function(userLoves){
				res.statusCode = 200;
				return res.json(parseData(userLoves, start, results));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown user " + username + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(parseData(JSON.parse(data), start, results));
	});
});

leveldb.open('fakedata.db', { create_if_missing: true }, function(err, data){
	console.log('server running.');
	console.log('database connected.');
	db = data;
	app.listen(8088);
});

function parseData(userLoves, start, results){
	var songs;
	if (start + results > userLoves.length){
		songs = userLoves.slice(start, userLoves.length - 1);
	}
	songs = userLoves.slice(start, start + results);
	return {
		'status_test': "OK",
		'status_code': 200,
		'results': songs.length,
		'start': start,
		'total': userLoves.length,
		'songs': songs
	};
}

function getData(username){
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
                    insertIntoDB(username, resultsSet).then(d.resolve);
                });
            }
            resultsSet = resultsSet.concat(res.body.songs);
            return d.resolve(resultsSet);
        });
    return d.promise;
}

function insertIntoDB(username, results){
	var d = when.defer();
	db.put(username, JSON.stringify(results), function(err){
		return d.resolve(results);
	});
	return d.promise;
}
