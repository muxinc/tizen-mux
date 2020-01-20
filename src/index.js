/* global webapis */
import mux from 'mux-embed';

const log = mux.log;
const assign = mux.utils.assign;
const getTimestamp = mux.utils.getTimestamp;

// Helper function to generate "unique" IDs for the player
const generateShortId = function () {
  return ('000000' + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6);
};

const monitorTizenPlayer = function (player, options) {
  if (player.tagName !== 'OBJECT') {
    log.warn('[tizen-mux] You must provide a valid tizen to monitorTizenPlayer.');
    return;
  }

  // Prepare the data passed in
  options = options || {};
  const defaults = {
    // Allow customers to be in full control of the "errors" that are fatal
    automaticErrorTracking: true
  };

  options = assign(defaults, options);

  options.data = assign({
    player_software_name: 'Tizen AVPlayer',
    player_software_version: webapis.avplay.getVersion(),
    player_mux_plugin_name: 'tizen-mux',
    player_mux_plugin_version: '[AIV]{version}[/AIV]'
  }, options.data);

  // Retrieve the ID and the player element
  const playerID = generateShortId();

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
  var onResolutionChanged = function () {
    let streamInfo = webapis.avplay.getCurrentStreamInfo();

    for (let i = 0; i < streamInfo.length; i++) {
      let track = streamInfo[i];

      if (track.type === 'VIDEO' && track.extra_info) {
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
  var isBuffering = false;
  var isSeeking = false;

  // Allow mux to retrieve the current time - used to track buffering from the mux side
  // Return current playhead time in milliseconds
  options.getPlayheadTime = () => {
    return webapis.avplay.getCurrentTime();
  };

  // Allow mux to automatically retrieve state information about the player on each event sent
  options.getStateData = () => {
    let stateData = {
      player_width: player.offsetWidth,
      player_height: player.offsetHeight,
      player_is_fullscreen: player.fullscreen,
      player_autoplay_on: player.autoplay,
      player_preload_on: player.preload,
      video_source_url: player.url,
      video_source_mime_type: player.mimeType,
      video_poster_url: player.poster,
      player_language_code: player.language
    };

    // Additional required properties
    const state = webapis.avplay.getState();

    stateData.player_is_paused = (state === 'NONE' || state === 'IDLE' || state === 'READY' || state === 'PAUSED');
    if (videoSourceWidth !== 0) {
      stateData.video_source_width = videoSourceWidth;
    }
    if (videoSourceHeight !== 0) {
      stateData.video_source_height = videoSourceHeight;
    }
    // Additional peferred properties
    if (lastPlayerState !== 'NONE' && lastPlayerState !== 'IDLE') {
      const duration = webapis.avplay.getDuration();

      stateData.video_source_duration = (duration === 0 ? Infinity : duration);
    }

    return stateData;
  };

  // The following are linking events that the Mux core SDK requires with events from the player.
  const playbackListener = {
    onbufferingstart: function () {
      isBuffering = true;
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
      isBuffering = false;
      if (isSeeking) {
        isSeeking = false;
        player.mux.emit('seeked');
      }
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
      if (eventType === 'PLAYER_MSG_BITRATE_CHANGE') {
        player.mux.emit('ratechange');
      } else if (eventType === 'PLAYER_MSG_RESOLUTION_CHANGED') {
        onResolutionChanged();
      } else if (eventType === 'PLAYER_MSG_FRAGMENT_INFO') {
        // Note: This event was not fired while watching either our sample HLS or DASH streams.
        // Without observing this event, we cannot implement any detailed request monitoring.
      } else if (eventType === 'PLAYER_MSG_HTTP_ERROR_CODE') {
        // Note: This event has the same problem as PLAYER_MSG_FRAGMENT_INFO.
      }
      if (player.playbackCallback && player.playbackCallback.onevent) {
        setTimeout(() => {
          player.playbackCallback.onevent(eventType, eventData);
        }, 0);
      }
    },

    onerror: function (eventType) {
      if (!options.automaticErrorTracking) { return; }
      player.mux.emit('error', { player_error_code: -1, player_error_message: eventType });
      if (player.playbackCallback && player.playbackCallback.onerror) {
        setTimeout(() => {
          player.playbackCallback.onerror(eventType);
        }, 0);
      }
    },

    ondrmevent: function (drmEvent, drmData) {
      if (player.playbackCallback && player.playbackCallback.ondrmevent) {
        setTimeout(() => {
          player.playbackCallback.ondrmevent(drmEvent, drmData);
        }, 0);
      }
    },

    onsubtitlechange: function (duration, text, type, attriCount, attributes) {
      if (player.playbackCallback && player.playbackCallback.onsubtitlechange) {
        setTimeout(() => {
          player.playbackCallback.onsubtitlechange(duration, text, type, attriCount, attributes);
        }, 0);
      }
    }
  };

  webapis.avplay.setListener(playbackListener);

  let lastPlaybackTimeUpdated = getTimestamp();
  let lastPlaybackPosition = 0;
  const MAX_SECONDS_SEEK_PLAYHEAD_SHIFT = 500;
  const SEEK_PLAYHEAD_DRIFT_MS = 200;

  player.checkStatusInterval = window.setInterval(function () {
    try {
      const playerState = webapis.avplay.getState();

      switch (lastPlayerState) {
        case 'NONE':
        case 'READY':
        case 'IDLE':
          if (playerState === 'PLAYING') {
            onResolutionChanged();
            player.mux.emit('play');
            player.mux.emit('playing');
          }
          break;
        case 'PLAYING':
          if (playerState === 'PAUSED') {
            player.mux.emit('pause');
          }
          break;
        case 'PAUSED':
          if (playerState === 'PLAYING') {
            player.mux.emit('play');
            player.mux.emit('playing');
          }
          break;
      }
      if (lastPlayerState !== playerState) {
        log.info('state transition ' + lastPlayerState + ' -> ' + playerState);
      }
      lastPlayerState = playerState;

      if (isBuffering && playerState === 'PLAYING') {
        if (!isSeeking) {
          const playheadTimeElapsed = webapis.avplay.getCurrentTime() - lastPlaybackPosition;
          const wallTimeElapsed = getTimestamp() - lastPlaybackTimeUpdated;
          const drift = playheadTimeElapsed - wallTimeElapsed;

          if (Math.abs(playheadTimeElapsed) > MAX_SECONDS_SEEK_PLAYHEAD_SHIFT && Math.abs(drift) > SEEK_PLAYHEAD_DRIFT_MS) {
            isSeeking = true;
            player.mux.emit('seeking');
          }
        }
      }
      lastPlaybackTimeUpdated = getTimestamp();
    } catch (e) {
      log.error(e);
    }
  }, 50);

  // Expose ability to stop monitoring
  player.mux.stopMonitor = () => {
    window.clearInterval(player.checkStatusInterval);
    if (player.playbackCallback) {
      webapis.avplay.setListener(player.playbackCallback);
    }
    player.mux.emit('destroy');
    player.mux.emit = function () {};
  };

  // Lastly, initialize the tracking
  mux.init(playerID, options);
};

export default monitorTizenPlayer;
