"use strict";

var express = require('express'),
	fs = require('fs'),
	when = require('when'),
	request = require('superagent'),
	leveldb = require('leveldb');

var app = express(),
	db,
	apiBaseUrl = 'http://ex.fm/api/v3';

app.use(express.bodyParser());

app.get('/api/v3/user/:user/loved', function(req, res){
	var start = parseInt(req.query.start, 10) || 0,
		results = parseInt(req.query.results, 10) || 20,
		username = req.params.user;

	db.get(username, function(err, data){
		if (data === null){
			return getAllData('user', username).then(function(userLoves){
				res.statusCode = 200;
				return res.json(parseSongs(userLoves, start, results));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown user " + username + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(parseSongs(JSON.parse(data), start, results));
	});
});

app.get('/api/v3/site/:site/songs', function(req, res){
	var start = parseInt(req.query.start, 10) || 0,
		results = parseInt(req.query.results, 10) || 20,
		site = req.params.site;

	db.get(site, function(err, data){
		if (data === null){
			return getAllData('site', site).then(function(siteSongs){
				res.statusCode = 200;
				return res.json(parseSongs(siteSongs, start, results));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown site " + site + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(parseSongs(JSON.parse(data), start, results));
	});
});

app.get('/api/v3/user/:user/loved-ids', function(req, res){
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

// Temporary path until this route is deployed to exfm prod
app.get('/api/v3/explore/:tag/song-ids', function(req, res){
    var songIds = [],
        i;

    if(req.params.tag === 'twohundredsongs'){
        for(i = 1; i < 201; i++){
            songIds.push(i);
        }
    }

    return res.send({
        'total': 50000,
        'start': 0,
        'results': songIds.length,
        'song_ids': songIds
    });
});

app.post('/shuffle/new_songs', function(req, res){
	return res.send({
		'tokens': req.body.tokens.length,
		'new_songs': req.body.new_songs.length
	});
});

app.get('/shuffle/:token/last-new-songs', function(req, res){
	return res.send({
		'last_new_songs': "2012-12-10T23:18:21.630Z"
	});
});

leveldb.open(__dirname + '/fakedata.db', { create_if_missing: true }, function(err, data){
	console.log('server running.');
	console.log('database connected.');
	db = data;
	app.listen(8088);
});

function parseSongs(s, start, results){
	var songs;
	if (start + results > s.length){
		songs = s.slice(start, s.length);
	}
	else {
		songs = s.slice(start, start + results);
	}
	return {
		'status_test': "OK",
		'status_code': 200,
		'results': songs.length,
		'start': start,
		'total': s.length,
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

function getAllData(entityType, entity){
    var d = when.defer(),
        resultsSet = [],
        resultsSize = 100,
        start = 0,
        startArray = [],
        path;

    if (entityType === 'user') {
		path = apiBaseUrl + '/user/' + entity + '/loved';
    }
    if (entityType === 'site') {
		path = apiBaseUrl + '/site/' + entity + '/songs';
    }
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
                    d.resolve(insertIntoDB(entity, resultsSet));
                });
            }
            resultsSet = resultsSet.concat(res.body.songs);
            d.resolve(insertIntoDB(entity, resultsSet));
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
