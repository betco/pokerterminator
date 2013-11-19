(function($) {
//	the escape key interrupts ajax and websocket connections on firefox
//	see https://bugzilla.mozilla.org/show_bug.cgi?id=614304
	$(window).keydown(function(event) {
		if (event.which == 27) event.preventDefault();
	});

//	get type of an object, see http://stackoverflow.com/questions/332422
	function get_type(thing) {
		if(thing===null)return "[object Null]"; // special case
		return Object.prototype.toString.call(thing);
	}
	
//	load global terminator settings
	var settings = $.extend({}, pokerTerminatorSettings);
	settings.ping_interval = 240000;
	settings.address = (typeof tableServerAddress == 'undefined') ? '' : tableServerAddress;
	settings.path = (typeof settings.path == 'undefined') ? '/' : settings.path;

//	FIXME backwards compatibility check
	if (settings.resource) {
		settings.path += settings.resource;
		delete settings.resource;
	}
	
	var jpoker = $.jpoker;
	
	var warningShouldBeIgnored = function(reason) {
		var ignored = [
			/^poker.terminator - error:.*probe error/,
		];
		for (var i=0; i<ignored.length; i++) {
			if (reason.match(ignored[i])) return true;
		}
		return false;
	};
	
//	overload error function
	jpoker.connection.prototype.error_original = jpoker.connection.prototype.error;
	jpoker.connection.prototype.error =
	jpoker.server.prototype.error = function(reason) {
		// $('#loader').hide();		
		var reset_original = this.reset;
		this.reset = function() {};
		try { return jpoker.connection.prototype.error_original.apply(this, arguments); }
		finally { this.reset = reset_original; }
	};
	
//	overload warn function
	jpoker.connection.prototype.warning_original = jpoker.connection.prototype.warning;
	jpoker.connection.prototype.warning =
	jpoker.server.prototype.warning = function(reason) {
		if (warningShouldBeIgnored(reason)) return;
		jpoker.connection.prototype.warning_original.apply(this, arguments);
		
		// $('#loader').show();
		var that = this;
		var game_ids = $.map(this.tables, function(t) { return t.id; });
		
		clearTimeout(this.socket_connection_issue_timer);
		if (that.socket_connection_issues > that.socket_connection_issues_max) return;
		
		this.socket_connection_issue_timer = setTimeout(function() {
			that.socket_connection_issues += 1;
			if (that.socket_connection_issues >= that.socket_connection_issues_max) {
				return that.error.call(that, reason);
			}
			that.reset();
			that.socket.once('open',function(auth_status) {
				$.each(game_ids, function(k, game_id) {
					that.tableJoin(game_id);
				});
			});
		}, this.socket_reconnect_wait_time);		
	};
	
//	longpoll is disabled
	jpoker.connection.prototype.longPoll = function() {};
	jpoker.connection.prototype.scheduleLongPoll = function() {};	

//	overwrite sendPacket and friends
	jpoker.connection.prototype.sendPacket =
	jpoker.server.prototype.sendPacket = function(packet, callback) {
		this.sendPacketIo(packet, 'queue', callback);
	};
	
	jpoker.connection.prototype.receivePacket = 
	jpoker.server.prototype.receivePacket = function(packets) {
		this.transformPacketTypes(packets);
		while ((packet = packets.shift()) !== undefined)
			this.handle(packet.type == 'PacketPokerTable' ? 0 : ~~packet.game_id, packet);
	};
	
	jpoker.server.prototype.sendPacketIo = 
	jpoker.connection.prototype.sendPacketIo = function(packet, mode, callback) {
		if(jpoker.verbose > 0) jpoker.message('sendPacket ' + JSON.stringify(packet));
		var packet_to_send = packet;
		if (jpoker.send_numeric_packet_type && typeof packet.type !== 'number') {
			packet_to_send = $.extend(
				{}, packet,
				{type: jpoker.packetName2Type[jpoker.toCapsType(packet.type)]}
			);
		}
		this.sentTime = jpoker.now();
		if (this.socket) {
			this.resetPing();
			this.socket.send_ns('pkt', [packet_to_send]);
		}
		else {
			this.socket_pre_buffer.push(packet);
		}
		if (typeof callback == 'function') {
			callback();
		}
	};
	
//	add some comodity functions for pinging
	jpoker.server.prototype.sendPing =
	jpoker.connection.prototype.sendPing = function() {
		return this.sendPacket({type: 'PacketPing'});		
	};
	jpoker.server.prototype.clearPing = 
	jpoker.connection.prototype.clearPing = function () {
		if (this.socket_ping_interval !== null) {
			clearInterval(this.socket_ping_interval);
		}
		this.socket_ping_interval = null;
	};
	jpoker.server.prototype.resetPing = 
	jpoker.connection.prototype.resetPing = function () {
		var that = this;
		this.clearPing();
		this.socket_ping_interval = setInterval(function() {
			that.sendPing();
		}, settings.ping_interval);
	};
	
//	save original init and overwrite it 
	jpoker.connection.prototype.init_original = jpoker.connection.prototype.init;
	jpoker.connection.prototype.init = function() {
		this.socket = null;
		this.socket_pre_buffer = [];
		this.socket_ping_interval = null;
		this.socket_window_unloading = false;
		this.socket_window_unloading_fn = null;
		this.socket_connection_issues_max = 20;
		this.socket_connection_issues = 0;
		this.socket_reconnect_wait_time = 1500;
		jpoker.connection.prototype.init_original.call(this);
	};
	
//	save original reset and overwrite it 
	jpoker.connection.prototype.reset_original = jpoker.connection.prototype.reset;
	jpoker.connection.prototype.reset = function() {
		var that = this;
		jpoker.connection.prototype.reset_original.call(this);
		
//		disconnect socket, if already existing
		if (this.socket !== null) {
			this.socket.removeAllListeners('close');
			this.socket.close();
		}
		
//		reset ping interval
		jpoker.connection.prototype.clearPing.call(this);

//		unload the beforeunload handler
		$(window).unbind('beforeunload',this.socket_window_unloading_fn);
		
//		reset socket states
		this.socket_pre_buffer = [];
		this.socket_ping_interval = null;
		this.socket_window_unloading_fn = null;
		this.socket_window_unloading = false;
		clearTimeout(this.socket_connection_issue_timer);
		
//		create and bind the new beforeunload handler
		this.socket_window_unloading_fn = function() { that.socket_window_unloading = true;	};
		$(window).bind('beforeunload',this.socket_window_unloading_fn);

//		create new socket
		var secure_socket = document.location.protocol == 'https:' || settings.secure !== false;
		this.socket = new nsio.Socket({
			secure: secure_socket,
			host: this.url.match(/(https?:|)\/\/([^\/:]*)/)[2],
			port: secure_socket ? settings.port_secure : settings.port,
			path: settings.path,
			transports: settings.transports,
			upgrade: settings.upgrade
		});
		
//		register socket callbacks
//		that.session_uid,
//		that.auth,
		
		this.socket.once('open', function() {
			var packets = that.socket_pre_buffer;
			that.socket_pre_buffer = [];
	
			$.each(packets, function(i,packet) {that.sendPacket(packet);});			
		});
		
		
		this.socket.on('pkt', function(data) {
			jpoker.connection.prototype.receivePacket.call(that, data);
		});
		
		
		this.socket.on('close', function(reason,description) {
			if (!that.socket_window_unloading) {
				var close_repr = JSON.stringify({reason:reason,description:description});
				var err_formatted = 'poker.terminator - close: {r}'.supplant({r: close_repr});
				if (typeof that.warning == 'function') that.warning(err_formatted);
			}
		});
		
		
		this.socket.on('error', function(err,description) {
			if (!that.socket_window_unloading) {
				var err_repr = (get_type(err) == '[object Error]')
					? '{type: "{t}", message: "{m}", transport: "{tr}"}'.supplant({t: err.type ? err.type : 'Error', m: err.message, tr: err.transport || 'n/a'})
					: JSON.stringify(err);
				var err_formatted = 'poker.terminator - error: {r}'.supplant({r: err_repr});
				if (typeof that.warning == 'function') that.warning(err_formatted, err);
			}
		});
	};
	
})(jQuery);
