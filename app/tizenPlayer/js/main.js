var app = {
    init: function () {
        var container = $('#playerContainer');
        var playerHtml = $('<object id="thePlayer" type="application/avplayer" style="width:100%; height:100%;"></object>');
        container.append(playerHtml);

        document.addEventListener('keydown', function (event) {
            switch(this.getKeyCode(event)) {
                case app.KEY_LEFT:
                    if (this.currentBtnIndex > 0)
                        this.currentBtnIndex--;
                    break;
                case app.KEY_RIGHT:
                    if (this.currentBtnIndex < 6)
                        this.currentBtnIndex++;
                    break;
                case app.KEY_OK:
                    switch(this.currentBtnIndex) {
                        case 0:
                            this.play();
                            break;
                        case 1:
                            this.stop();
                            break;
                        case 2:
                            webapis.avplay.pause();
                            break;
                        case 3:
                            webapis.avplay.play();
                            break;
                        case 4:
                            webapis.avplay.seekTo(webapis.avplay.getCurrentTime() - (10 * 1000));
                            break;
                        case 5:
                            webapis.avplay.seekTo(webapis.avplay.getCurrentTime() + (10 * 1000));
                            break;
                    }
                    break;
                default:
                    break;
            }
            switch(this.currentBtnIndex) {
                case 0:
                    $('#btnPlay').focus();
                    break;
                case 1:
                    $('#btnStop').focus();
                    break;
                case 2:
                    $('#btnPause').focus();
                    break;
                case 3:
                    $('#btnResume').focus();
                    break;
                case 4:
                    $('#btnRewind').focus();
                    break;
                case 5:
                    $('#btnForward').focus();
                default:
                    break;
            }
            event.preventDefault();
            return true;
        }.bind(this));
        this.currentBtnIndex = 0;
        $('#btnPlay').focus();

        try {
            webapis.avplay.open(this.url);
            webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        } catch (e) {
            console.log(e);
            return;
        }
    },

    prepare: function() {
        var PrepareSuccessCallback = function () {
            console.log("Player state: " + webapis.avplay.getState());
            webapis.avplay.play();
        }.bind(this);
        var PrepareErrorCallback = function (error) {
            console.log('PrepareErrorCallback ' + error);
        };
        webapis.avplay.prepareAsync(PrepareSuccessCallback, PrepareErrorCallback);
    },

    getKeyCode: function(event) {
        switch (event.keyCode) {
            case 40:
                return app.KEY_DOWN;
            case 37:
                return app.KEY_LEFT;
            case 39:
                return app.KEY_RIGHT;
            case 38:
                return app.KEY_UP;
            case 13:
                return app.KEY_OK;
            case 8:
            case 27:
            case 10009:
                return app.KEY_BACK;
            case 412:
                return app.KEY_REWIND;
            case 19:
                return app.KEY_PAUSE;
            case 417:
                return app.KEY_FORWARD;
            case 415:
                return app.KEY_PLAY;
            case 413:
                return app.KEY_STOP;
            default:
                return app.KEY_UNKNOWN;
        }
    },

    play: function() {
      var playbackListener = {
          onbufferingstart: function () {
          },

          onbufferingprogress: function (percent) {
          },

          onbufferingcomplete: function () {
          },

          oncurrentplaytime: function (currentTime) {
            //console.log("Current playtime: " + currentTime);
          },

          onstreamcompleted: function () {
        	  app.stop();
          },

          onevent: function (eventType, eventData) {
            console.log("eventType: " + eventType + ", " + eventData);
          },

          onerror: function (eventType) {
          },

          ondrmevent: function(drmEvent, drmData) {
          },

          onsubtitlechange: function(duration, text, type, attriCount, attributes) {
          }
      }
      var player = $('#thePlayer').get(0);
      player.url = this.url;
      player.playbackCallback = playbackListener;
      var playerInitTime = Date.now();
      this.prepare();
      tizenMux.monitorTizenPlayer(player, {
          debug: true,
          data: {
            video_title: 'BigBuckBunny.smil',
            env_key: 'hrca1hhidk4je5lbtcvjsj4sm',
            player_init_time: playerInitTime,
          }
      });
    },

    stop: function() {
      var player = $('#thePlayer').get(0);
      tizenMux.stopMonitor(player);
      webapis.avplay.stop();
    }
};

$(document).ready(function () {
    app.KEY_UNKNOWN = -1;
    app.KEY_OK = 0;
    app.KEY_INFO = 1;
    app.KEY_UP = 2;
    app.KEY_DOWN = 3;
    app.KEY_LEFT = 4;
    app.KEY_RIGHT = 5;
    app.KEY_REWIND = 6;
    app.KEY_FORWARD = 7;
    app.KEY_MENU = 8;
    app.KEY_PLAY = 9;
    app.KEY_PAUSE = 10;
    app.KEY_BACK = 11;
    app.KEY_STOP = 12;
    //app.url = 'http://184.72.239.149/vod/smil:BigBuckBunny.smil/playlist.m3u8';
    //app.url = 'https://cspan1nontve-lh.akamaihd.net/i/CSpan1NonTVE_1@312667/index_400_av-p.m3u8';
    app.url = 'http://dash.edgesuite.net/envivio/EnvivioDash3/manifest.mpd';

    app.init();
});
