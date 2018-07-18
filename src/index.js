// import window from 'global/window'; // Remove if you do not need to access the global `window`
// import document from 'global/document'; // Remove if you do not need to access the global `document`
import mux from 'mux-embed';

const log = mux.log;
const assign = mux.utils.assign;
// const getComputedStyle = mux.utils.getComputedStyle; // If necessary to get

// Helper function to generate "unique" IDs for the player if your player does not have one built in
const generateShortId = function () {
  return ('000000' + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6);
};

const monitorTizenPlayer = function (player, options) {
  // Make sure we got a player - Check properties to ensure that a player was passed
  if (player.tagName !== 'OBJECT') {
    log.warn('[tizen-mux] You must provide a valid tizen to monitorTizenPlayer.');
    return;
  }

  // Accessor for event namespace if used by your player
  // const YOURPLAYER_EVENTS = || {};

  // Prepare the data passed in
  options = options || {};

  options.data = assign({
    player_software_name: 'Tizen AVPlayer',
    player_software_version: webapis.avplay.getVersion(), // Replace with method to retrieve the version of the player as necessary
    player_mux_plugin_name: 'tizen-mux',
    player_mux_plugin_version: '[AIV]{version}[/AIV]',
    player_init_time: Date.now(),
  }, options.data);

  // Retrieve the ID and the player element
  const playerID = generateShortId(); // Replace with your own ID if you have one that's unique per player in page

  // Enable customers to emit events through the player instance
  player.mux = {};
  player.mux.emit = function (eventType, data) {
    mux.emit(playerID, eventType, data);
  };

  // Player state data
  player.lastPlayerState = 'NONE';
  player.videoSourceWidth = 0;
  player.videoSourceHeight = 0;
  player.loadStarts = false;
  player.playStarts = false;
  player.onResolutionChanged = function() {
    let streamInfo = webapis.avplay.getCurrentStreamInfo();
    for (let i = 0; i < streamInfo.length; i++) {
      let track = streamInfo[i];
      if (track.type == 'VIDEO' && track.extra_info) {
        if (typeof track.extra_info === 'string') {
          let json = JSON.parse(track.extra_info);
          this.videoSourceWidth = parseInt(json.Width);
          this.videoSourceHeight = parseInt(json.Height);
        } else {
          this.videoSourceWidth = track.extra_info.Width;
          this.videoSourceHeight = track.extra_info.Height;
        }
      }
    }
  };

  // Allow mux to retrieve the current time - used to track buffering from the mux side
  // Return current playhead time in milliseconds
  options.getPlayheadTime = () => {
    return webapis.avplay.getCurrentTime();
  };

  // Allow mux to automatically retrieve state information about the player on each event sent
  // If these properties are not accessible through getters at runtime, you may need to set them
  // on certain events and store them in a local variable, and return them in the method e.g.
  //    let playerWidth, playerHeight;
  //    player.on('resize', (width, height) => {
  //      playerWidth = width;
  //      playerHeight = height;
  //    });
  //    options.getStateData = () => {
  //      return {
  //        ...
  //        player_width: playerWidth,
  //        player_height: playerHeight
  //      };
  //    };
  options.getStateData = () => {
    let stateData = {
      player_is_paused: webapis.avplay.getState() == 'PAUSED',
      player_playhead_time: webapis.avplay.getCurrentTime(),
      player_width: player.offsetWidth,
      player_height: player.offsetHeight
    };
    // Required properties - these must be provided every time this is called
    // You _should_ only provide these values if they are defined (i.e. not 'undefined')
    if (player.videoSourceWidth != 0) {
      stateData.video_source_width = player.videoSourceWidth;
    }
    if (player.videoSourceHeight != 0) {
      stateData.video_source_height = player.videoSourceHeight;
    }

    // Preferred properties - these should be provided in this callback if possible
    // If any are missing, that is okay, but this will be a lack of data for the customer at a later time
    if (player.fullscreen != undefined) {
      stateData.player_is_fullscreen = player.fullscreen;
    }
    if (player.autoplay != undefined) {
      stateData.player_autoplay_on = player.autoplay;
    }
    if (player.preload != undefined) {
      stateData.player_preload_on = player.preload;
    }
    if (player.url != undefined) {
      stateData.video_source_url = player.url;
    }
    if (player.mimeType != undefined) {
      stateData.video_source_mime_type = player.mimeType;
    }
    if (player.lastPlayerState != 'NONE' && player.lastPlayerState != 'IDLE') {
      stateData.video_source_duration = (webapis.avplay.getDuration() == 0 ? Infinity : webapis.avplay.getDuration());
    }

    // Optional properties - if you have them, send them, but if not, no big deal
    if (player.poster != undefined) {
      stateData.video_poster_url = player.poster;
    }
    if (player.language != undefined) {
      stateData.player_language_code = player.language;
    }

    return stateData;
  };

  // The following are linking events that the Mux core SDK requires with events from the player.
  // There may be some cases where the player will send the same Mux event on multiple different
  // events at the player level (e.g. mux.emit('play') may be as a result of multiple player events)
  // OR multiple mux events will be sent as the result of a single player event (e.g. if there is
  // a single event for breaking to a midroll ad, and mux requires a `pause` and an `adbreakstart` event both)
  let playbackListener = {
    onbufferingstart: function () {
      if (!this.loadStarts) {
        this.mux.emit('loadstart', {});
        this.loadStarts = true;
      }
      if (this.playbackCallback) {
        this.playbackCallback.onbufferingstart();
      }
    }.bind(player),

    onbufferingprogress: function (percent) {
      if (this.playbackCallback) {
        this.playbackCallback.onbufferingprogress(percent);
      }
    }.bind(player),

    onbufferingcomplete: function () {
      if (!this.playStarts) {
        this.playStarts = true;
        log.info('All tracks info,');
        let tracks = webapis.avplay.getTotalTrackInfo();
        for (let i = 0; i < tracks.length; i++) {
          log.info(tracks[i]);
        }
      }
      if (this.playbackCallback) {
        this.playbackCallback.onbufferingcomplete();
      }
    }.bind(player),

    oncurrentplaytime: function (currentTime) {
      this.mux.emit('timeupdate', {});
      if (this.playbackCallback) {
        this.playbackCallback.oncurrentplaytime(currentTime);
      }
    }.bind(player),

    onstreamcompleted: function () {
      this.mux.emit('ended', {});
      if (this.playbackCallback) {
        this.playbackCallback.onstreamcompleted();
      }
    }.bind(player),

    onevent: function (eventType, eventData) {
      if (eventType == 'PLAYER_MSG_BITRATE_CHANGE') {
        this.mux.emit('ratechange', {});
      } else if (eventType == 'PLAYER_MSG_RESOLUTION_CHANGED') {
        this.onResolutionChanged();
      } else if (eventType == 'PLAYER_MSG_FRAGMENT_INFO') {
        // not detected on both sample HLS and Dash stream
        // thus no way to do bandwidth metric fragment loadData collection
      } else if (eventType == 'PLAYER_MSG_HTTP_ERROR_CODE') {
        // placeholder for bandwidth metric fragment download error collection
      }
      if (this.playbackCallback) {
        this.playbackCallback.onevent(eventType, eventData);
      }

    }.bind(player),

    onerror: function (eventType) {
      let data = {
        player_error_code: -1,
        player_error_message: eventType
      };
      this.mux.emit('error', data);
      if (this.playbackCallback) {
        this.playbackCallback.onerror(eventType);
      }
    }.bind(player),

    ondrmevent: function(drmEvent, drmData) {
      if (this.playbackCallback) {
        this.playbackCallback.ondrmevent(drmEvent, drmData);
      }
    }.bind(player),

    onsubtitlechange: function(duration, text, type, attriCount, attributes) {
      if (this.playbackCallback) {
        this.playbackCallback.onsubtitlechange(duration, text, type, attriCount, attributes);
      }
    }.bind(player)
  };
  webapis.avplay.setListener(playbackListener);

  player.checkStatusInterval = window.setInterval(function() {
    try {
      let playerState = webapis.avplay.getState();
      if (this.lastPlayerState == 'NONE' || this.lastPlayerState == 'READY' || this.lastPlayerState == 'IDLE') {
        if (playerState == 'PLAYING') {
          this.onResolutionChanged();
          this.mux.emit('playing', {});
        }
      } else if (this.lastPlayerState == 'PLAYING') {
        if (playerState == 'PAUSED') {
          this.mux.emit('pause', {});
        }
      } else if (this.lastPlayerState == 'PAUSED') {
        if (playerState == 'PLAYING') {
          this.mux.emit('playing', {});
        }
      }
      if (this.lastPlayerState != playerState) {
        log.info('state transition ' + this.lastPlayerState + ' -> ' + playerState);
      }
      this.lastPlayerState = playerState;
    } catch(e) {
      log.error(e);
    }
  }.bind(player), 50);

  // Lastly, initialize the tracking
  mux.init(playerID, options);
};

const stopMonitor = function (player) {
  window.clearInterval(player.checkStatusInterval);
  if (player.playbackCallback) {
    webapis.avplay.setListener(player.playbackCallback);
  }
  player.mux.emit('destroy', {});
  player.mux.emit = function(){};
}

export { monitorTizenPlayer, stopMonitor };
