const fs = require('fs');
const express = require('express');
const https = require('https');
const cors = require('cors');
const axios = require('axios');
const app = express();
const passwordList = {};
const hostList = {};
const emailList = {};

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cors());

app.get('/room/:room', (req, res) => {
	if (req.headers.referer === 'https://192.168.35.115:80/waittingroom') {
		res.render('room.ejs', {
			roomId: req.params.room,
			test: req,
		});
	} else {
		res.redirect('https://192.168.35.115:80/waittingroom');
	}
});

server = https.createServer(
	{
		key: fs.readFileSync('private.pem'),
		cert: fs.readFileSync('public.pem'),
	},
	app
);
const io = require('socket.io')(server);

io.on('connection', socket => {
	//클라이언트가 맨처음 로딩 시 방에 대해서 체크
	socket.on('check-room', roomId => {
		socket.emit(
			'enter-room',
			passwordList[roomId],
			io.sockets.adapter.rooms[roomId] //현재 방에 있는 인원수
		);
	});

	socket.on('join-room', (roomId, userId) => {
		let clientsInRoom = io.sockets.adapter.rooms[roomId];
		let numClients = clientsInRoom
			? Object.keys(clientsInRoom.sockets).length
			: 0;

		//방에 처음 들어가는거면 방장 권한 줌
		if (numClients === 0) {
			hostList[roomId] = userId;
			socket.emit('set-host', userId);
		}

		socket.join(roomId);
		socket.to(roomId).broadcast.emit('user-connected', userId);

		//연결이 끊어졌을 때
		socket.on('disconnect', () => {
			axios.get(
				`https://192.168.35.115:80/exitroom/room/${roomId}/user/${emailList[userId]}`
			);

			socket.to(roomId).broadcast.emit('user-disconnected', userId);

			if (hostList[roomId] === userId) {
				delete hostList[roomId];
				socket.to(roomId).broadcast.emit('host-disconnected');
			}

			if (io.engine.clientsCount === 0) {
				delete passwordList[roomId];
				delete hostList[roomId];
			}
		});
	});

	//사용자가 서버에 보내는 방 설정
	socket.on('password', (roomId, password) => {
		passwordList[roomId] = password;
	});

	//제목 설정
	socket.on('title', (roomId, title) => {
		socket.to(roomId).broadcast.emit('set-title', title);
	});

	socket.on('host', (roomId, userId) => {
		hostList[roomId] = userId;
		socket.emit('set-host', hostList[roomId]);
		socket.to(roomId).broadcast.emit('set-host', hostList[roomId]);
	});

	socket.on('host-reset', (roomId, userId) => {
		if (typeof hostList[roomId] === 'undefined') {
			hostList[roomId] = userId;
			socket.emit('set-host', hostList[roomId]);
		}
	});

	//강퇴
	socket.on('retire', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('retire-user', userId);
	});

	//오디오 비디오 끄기
	socket.on('audio', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('set-audio', userId);
	});

	socket.on('video', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('set-video', userId);
	});

	//클럽하우스 모드
	socket.on('on-clubhouse', roomId => {
		socket.to(roomId).broadcast.emit('set-clubhouse');
	});

	socket.on('off-clubhouse', roomId => {
		socket.to(roomId).broadcast.emit('remove-clubhouse');
	});

	//발언권 주기
	socket.on('voice', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('set-voice', userId);
	});

	//peerid로 uesrEmail찾기
	socket.on('email', (userId, userEmail) => {
		emailList[userId] = userEmail;
	});

	//timer설정
	socket.on('on-countUp', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('set-countUp', userId);
	});

	socket.on('on-countDown', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('set-countDown', userId);
	});

	socket.on('off-count', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('stop-count', userId);
	});

	socket.on('reset-count', (roomId, userId) => {
		socket.to(roomId).broadcast.emit('remove-count', userId);
	});

	socket.on('userInfo', userId => {
		socket.emit('alert-userInfo', emailList[userId]);
	});
});

server.listen(3333, '0.0.0.0');