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
    player_mux_plugin_version: '0.1.0',
  }, options.data);

  // Retrieve the ID and the player element
  const playerID = generateShortId(); // Replace with your own ID if you have one that's unique per player in page

  // Enable customers to emit events through the player instance
  player.mux = {};
  player.mux.emit = function (eventType, data) {
    mux.emit(playerID, eventType, data);
  };

  // Player state data
  var lastPlayerState = 'NONE';
  var videoSourceWidth = 0;
  var videoSourceHeight = 0;
  var loadStarts = false;
  var onResolutionChanged = function() {
    let streamInfo = webapis.avplay.getCurrentStreamInfo();
    for (let i = 0; i < streamInfo.length; i++) {
      let track = streamInfo[i];
      if (track.type == 'VIDEO' && track.extra_info) {
        if (typeof track.extra_info === 'string') {
          let json = JSON.parse(track.extra_info);
          videoSourceWidth = parseInt(json.Width);
          videoSourceHeight = parseInt(json.Height);
        } else {
          videoSourceWidth = track.extra_info.Width;
          videoSourceHeight = track.extra_info.Height;
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
      // Required properties - these must be provided every time this is called
      // You _should_ only provide these values if they are defined (i.e. not 'undefined')
      player_width: player.offsetWidth,
      player_height: player.offsetHeight,

      // Preferred properties - these should be provided in this callback if possible
      // If any are missing, that is okay, but this will be a lack of data for the customer at a later time
      player_is_fullscreen: player.fullscreen,
      player_autoplay_on: player.autoplay,
      player_preload_on: player.preload,
      video_source_url: player.url,
      video_source_mime_type: player.mimeType,

      // Optional properties - if you have them, send them, but if not, no big deal
      video_poster_url: player.poster,
      player_language_code: player.language,
    };

    // Additional required properties
    var state = webapis.avplay.getState();
    stateData.player_is_paused = (state == 'NONE' || state == 'IDLE' || state == 'READY' || state == 'PAUSED');
    if (videoSourceWidth != 0) {
      stateData.video_source_width = videoSourceWidth;
    }
    if (videoSourceHeight != 0) {
      stateData.video_source_height = videoSourceHeight;
    }
    // Additional peferred properties
    if (lastPlayerState != 'NONE' && lastPlayerState != 'IDLE') {
      const duration = webapis.avplay.getDuration();
      stateData.video_source_duration = (duration == 0 ? Infinity : duration);
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
      if (!loadStarts) {
        player.mux.emit('loadstart');
        loadStarts = true;
      }
      if (player.playbackCallback && player.playbackCallback.onbufferingstart) {
        setTimeout(() => {
          player.playbackCallback.onbufferingstart();
        }, 0);
      }
    },

    onbufferingprogress: function (percent) {
      if (player.playbackCallback && player.playbackCallback.onbufferingprogress) {
        setTimeout(() => {
          player.playbackCallback.onbufferingprogress(percent);
        }, 0);
      }
    },

    onbufferingcomplete: function () {
      if (player.playbackCallback && player.playbackCallback.onbufferingcomplete) {
        setTimeout(() => {
          player.playbackCallback.onbufferingcomplete();
        }, 0);
      }
    },

    oncurrentplaytime: function (currentTime) {
      player.mux.emit('timeupdate');
      if (player.playbackCallback && player.playbackCallback.oncurrentplaytime) {
        setTimeout(() => {
          player.playbackCallback.oncurrentplaytime(currentTime);
        }, 0);
      }
    },

    onstreamcompleted: function () {
      player.mux.emit('ended');
      if (player.playbackCallback && player.playbackCallback.onstreamcompleted) {
        setTimeout(() => {
          player.playbackCallback.onstreamcompleted();
        }, 0);
      }
    },

    onevent: function (eventType, eventData) {
      if (eventType == 'PLAYER_MSG_BITRATE_CHANGE') {
        player.mux.emit('ratechange');
      } else if (eventType == 'PLAYER_MSG_RESOLUTION_CHANGED') {
        onResolutionChanged();
      } else if (eventType == 'PLAYER_MSG_FRAGMENT_INFO') {
        // not detected on both sample HLS and Dash stream
        // thus no way to do bandwidth metric fragment loadData collection
      } else if (eventType == 'PLAYER_MSG_HTTP_ERROR_CODE') {
        // placeholder for bandwidth metric fragment download error collection
      }
      if (player.playbackCallback && player.playbackCallback.onevent) {
        setTimeout(() => {
          player.playbackCallback.onevent(eventType, eventData);
        }, 0);
      }
    },

    onerror: function (eventType) {
      let data = {
        player_error_code: -1,
        player_error_message: eventType
      };
      player.mux.emit('error', data);
      if (player.playbackCallback && player.playbackCallback.onerror) {
        setTimeout(() => {
          player.playbackCallback.onerror(eventType);
        }, 0);
      }
    },

    ondrmevent: function(drmEvent, drmData) {
      if (player.playbackCallback && player.playbackCallback.ondrmevent) {
        setTimeout(() => {
          player.playbackCallback.ondrmevent(drmEvent, drmData);
        }, 0);
      }
    },

    onsubtitlechange: function(duration, text, type, attriCount, attributes) {
      if (player.playbackCallback && player.playbackCallback.onsubtitlechange) {
        setTimeout(() => {
          player.playbackCallback.onsubtitlechange(duration, text, type, attriCount, attributes);
        }, 0);
      }
    }
  };
  webapis.avplay.setListener(playbackListener);

  player.checkStatusInterval = window.setInterval(function() {
    try {
      let playerState = webapis.avplay.getState();
      if (lastPlayerState == 'NONE' || lastPlayerState == 'READY' || lastPlayerState == 'IDLE') {
        if (playerState == 'PLAYING') {
          onResolutionChanged();
          player.mux.emit('playing');
        }
      } else if (lastPlayerState == 'PLAYING') {
        if (playerState == 'PAUSED') {
          player.mux.emit('pause');
        }
      } else if (lastPlayerState == 'PAUSED') {
        if (playerState == 'PLAYING') {
          player.mux.emit('playing');
        }
      }
      if (lastPlayerState != playerState) {
        log.info('state transition ' + lastPlayerState + ' -> ' + playerState);
      }
      lastPlayerState = playerState;
    } catch(e) {
      log.error(e);
    }
  }, 50);

  // Lastly, initialize the tracking
  mux.init(playerID, options);
};

const stopMonitor = function (player) {
  window.clearInterval(player.checkStatusInterval);
  if (player.playbackCallback) {
    webapis.avplay.setListener(player.playbackCallback);
  }
  player.mux.emit('destroy');
  player.mux.emit = function(){};
}

export { monitorTizenPlayer, stopMonitor };
