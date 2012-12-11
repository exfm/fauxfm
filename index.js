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

app.get('/api/v3/site/:site/all-song-ids', function(req, res){
	var site = req.params.site;

	db.get('site:' + site + ':song_ids', function(err, data){
		if (data === null){
			return getUserOrSiteIds('site', site).then(function(song_ids){
				res.statusCode = 200;
				return res.json(makeResponse(song_ids));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown site " + site + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(makeResponse(JSON.parse(data)));
	});
});

app.get('/api/v3/user/:user/loved-ids', function(req, res){
	var user = req.params.user;
	db.get('user:' + user + ':song_ids', function(err, data){
		if (data === null){
			return getUserOrSiteIds('user', user).then(function(song_ids){
				res.statusCode = 200;
				return res.json(makeResponse(song_ids));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown user " + user + "."
				});
			});
		}
		res.statusCode = 200;
		return res.json(makeResponse(JSON.parse(data)));
	});
});

app.get('/api/v3/explore/:tag/song-ids', function(req, res){
    var tag = req.params.tag,
        results = req.query.results,
        song_ids;

    db.get('genre:' + tag + ':song_ids', function(err, data){
        if (data === null){
            return getGenreIds(tag, results).then(function(song_ids){
				res.statusCode = 200;
				return res.json(makeResponse(song_ids));
			}, function(){
				res.statusCode = 404;
				return res.send({
					'status_code': 404,
					'status_text': "Unknown genre " + tag + "."
				});
			});
        }
        return res.json(makeResponse(JSON.parse(data)));
    });
});

app.post('/shuffle/new-songs', function(req, res){
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

function makeResponse(songIds){
	return {
		'status_text': "OK",
		'status_code': 200,
		'total': songIds.length,
		'song_ids': songIds
	};
}

function getUserOrSiteIds(entity, tag){
    var d = when.defer(),
		map = {
			'user': '/user/' + tag + '/loved-ids',
			'site': '/site/' + tag + '/all-song-ids'
		};
     request
        .get(apiBaseUrl + map[entity])
        .end(function(res){
            if (res.statusCode !== 200){
                return d.reject();
            }
            return d.resolve(insertIntoDB(entity + ':' + tag + ':song_ids', res.body.song_ids));
        });
    return d.promise;
}

function getGenreIds(tag, results){
    var d = when.defer();
    request
		.get(apiBaseUrl + '/explore/' + tag + '/song-ids')
		.query({
			'results': results || 20
		})
		.end(function(res){
			if (res.statusCode !== 200){
				return d.reject();
			}
			return d.resolve(insertIntoDB('genre:' + tag + ':song_ids', res.body.song_ids));
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
