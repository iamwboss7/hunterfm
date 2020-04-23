const sHunter = {
    url: {
        "site": "https://hunter.fm",
        "cdn": "https://cdn.hunter.fm",
        "api": "https://api.hunter.fm"
    },
    sTop5: {
        "Time": 0,
        "TotalMusic": 0,
        "ID": 0,
        "user": 0,
        "station": null,
        "diffTime": 0,
    },
    DBVersion: 1,
    imgDefault: "img/bg_black.png",
    stations: [],
    socket: null,
    run: function () {
        sHunter.Live();
        if ($("#top5_result").length > 0) {
            sHunter.top5Time();
            sHunter.Top5();
        } else {
            sHunter.LiveIO();
            sHunter.slideStations();
            if ($(".history").length > 0) {
                $(".load").hide();
                $(".history .stations").change(sHunter.historyStation);
                $(".history .load").click(sHunter.historyLoadMore);
            }
        }
        sHunter.createLocalStorage();
        $(".result").click(sHunter.showToggle);
        $(".close").click(sHunter.showToggle);
        $(".share_music").keyup(sHunter.AutoComplet);
    },
    showToggle: function (event) {
        $("#top5_result").slideToggle("slow");
    },
    historyLoadMore: function () {
        const hash = $(".history .stations")[0].value;
        const last = $(".mbox:last").attr("date");
        if (hash != "" && last != "") {
            $(".load").hide();
            let s = null;
            for (let i = 0; s == null && i < sHunter.stations.length; i++)
                if (sHunter.stations[i].hash == hash)
                    s = sHunter.stations[i];
            if (s != null)
                sHunter.loadHistory(s, last);
        } else {
            $(".load").hide();
        }
    },
    historyStation: function (event) {
        const hash = $(this)[0].value;
        if (hash != "") {
            $(".list").html("");
            $(".load").hide();
            let s = null;
            for (let i = 0; s == null && i < sHunter.stations.length; i++)
                if (sHunter.stations[i].hash == hash)
                    s = sHunter.stations[i];
            if (s != null)
                sHunter.loadHistory(s);
        } else {
            $(".list").html("");
            $(".load").hide();
        }
    },
    encodeQueryData: function (data) {
        const ret = [];
        for (let d in data)
            ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
        return ret.join('&');
    },
    AutoComplet: function (event) {
        if (!sHunter.socket || $(".share_music").val().length < 2) {
            sHunter.musicsInsertList = [];
            $(".show_share").html("");
            return;
        }
        if (sHunter.sTop5.station.music.length > 100) {
            $(".show_share").html("");
            sHunter.musicsInsertList = [];
            sHunter.notifyBar('.show_share', 'error', 10000, 'Desculpe, mas o limite de 100 m&uacute;sicas para a vota&ccedil;&atilde;o foi atingido, tente na pr&oacute;xima ediÃ§Ã£o.');
            return;
        }
        if (sHunter.sTop5.station.flags.blockMusic) {
            $(".show_share").html("");
            sHunter.musicsInsertList = [];
            sHunter.notifyBar('.show_share', 'error', 10000, 'Desculpe, nÃ£o Ã© possivel inserir mais mÃºsicas pois o Top 5 estÃ¡ dentro dos 30 minutos finais.');
            return;
        }
        fetch(sHunter.url.api + "/musics/station?" + sHunter.encodeQueryData({
            filter: $(".share_music").val(),
            station: sHunter.sTop5.station.hash,
            top5: true
        }), {
            method: 'GET'
        }).then((response) => {
            if (!response.ok) {
                throw new Error('Bad status code from server.');
            }
            return response.json();
        }).then((music) => {
            $(".show_share").html("");
            sHunter.musicsInsertList = music;
            for (let i in music) {
                if ($(".toplist #top5[hash='" + music[i].hash + "']").length) {
                    continue;
                }
                const aux = !(music[i].name.indexOf("(") > -1);
                const {
                    check
                } = sHunter.checkInsert(music[i].hash);
                music[i].name = music[i].name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                    return a.toUpperCase();
                });
                $(".show_share").append('<div id="top5_box" class="' + (!check ? "block" : "") + '" hash="' + music[i].hash + '" onClick="sHunter.add(this);">' +
                    '<div class="cover">' +
                    '<img src="' + (music[i].thumb ? music[i].thumb["MDPI"] : sHunter.imgDefault) + '">' +
                    '</div>' +
                    '<div class="infos">' +
                    '<div class="singer">' + sHunter.montarNomes(music[i].singers) + '</div>' +
                    '<div class="title">' + music[i].name + sHunter.montarNomes(music[i].feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]") + '</div>' +
                    '</div>' +
                    '</div>');
            }
            if (music.length == 0)
                sHunter.notifyBar('.show_share', 'warning', 10000, 'NÃ£o foi encontrado resultado para sua busca.');
        }).catch((err) => {
            $(".show_share").html("");
            sHunter.musicsInsertList = [];
            sHunter.notifyBar('.show_share', 'error', 10000, 'Desculpe, tivemos problema ao efetuar a busca.');
        });
    },
    playList: function () { },
    top5Time: function () {
        setInterval(function () {
            if (sHunter.sTop5.station == null) return;
            const end = (new Date(sHunter.sTop5.station.time.end)).getTime();
            const cur = (new Date(sHunter.getTime())).getTime();
            let diff = parseInt((end - cur) / 1000);
            diff = diff < 0 ? 0 : diff;
            const hor = parseInt(diff / 3600);
            const min = parseInt((diff - (hor * 3600)) / 60);
            const sec = parseInt(diff - (hor * 3600 + min * 60));
            $("p.countdown").html((hor < 10 ? "0" + hor : hor) + ":" + (min < 10 ? "0" + min : min) + ":" + (sec < 10 ? "0" + sec : sec));
        }, 1000);
    },
    arrumar: function () {
        if (sHunter.sTop5.station == null) return;
        sHunter.sTop5.station.music.sort(function (a, b) {
            if (b.votes.like < a.votes.like) return -1;
            else if (b.votes.like > a.votes.like) return 1;
            else if (b.hash < a.hash) return -1;
            else return 1;
        });
        $("#list").height((sHunter.sTop5.station.music.length * 81) + 'px');
        const start = -690;
        let pos = 1;
        for (let i = 0; i < sHunter.sTop5.station.music.length; i++) {
            let _pos = start + (110 * i);
            if (i > 4)
                _pos += 150;
            if (i < 5 && !sHunter.checkMusic(sHunter.sTop5.station.music[i], i)) {
                $("#top5[hash='" + sHunter.sTop5.station.music[i].hash + "']").addClass("empate");
                $("#top5[hash='" + sHunter.sTop5.station.music[i].hash + "'] .pos").html("<img class='thinking' src='img/thinking.png' />");
            } else {
                $("#top5[hash='" + sHunter.sTop5.station.music[i].hash + "']").removeClass("empate");
                $("#top5[hash='" + sHunter.sTop5.station.music[i].hash + "'] .pos").html(pos);
                pos++;
            }
            $("#top5[hash='" + sHunter.sTop5.station.music[i].hash + "']").animate({
                top: _pos + 'px'
            }, 500);
        }
        var h = ((sHunter.sTop5.station.music.length - 5) * 110) + 20;
        $(".toplist").css({
            height: h + 'px'
        });
    },
    Live: function () {
        sHunter.loadStations();
    },
    LiveIO: function () {
        if (sHunter.socket != null) return;
        sHunter.socket = io(sHunter.url.api, {
            reconnect: true,
            forceNew: true,
            query: {
                server: 'live',
                station: 'all'
            }
        });
        sHunter.socket.on('update-now', sHunter.evt.UpdateNow);
        sHunter.socket.on('reconnect_attempt', () => {
            sHunter.socket.io.opts.query = {
                server: 'live',
                station: 'all'
            }
        });
    },
    Top5: function () {
        if (sHunter.socket != null) return;
        sHunter.socket = io(sHunter.url.api, {
            reconnect: true,
            forceNew: true,
            query: {
                server: 'top5',
                station: 'jl2vwy6i-apswl5mr-onw1zw43kc'
            }
        });
        sHunter.socket.on('top5-user', sHunter.evt.MyHash);
        sHunter.socket.on('top5-start', sHunter.evt.StartTop5);
        sHunter.socket.on('top5-winner', sHunter.evt.EndTop5);
        sHunter.socket.on('blockInsert', sHunter.evt.blockInsert);
        sHunter.socket.on('blockVotes', sHunter.evt.blockVotes);
        sHunter.socket.on('resetVotes', sHunter.evt.resetVotes);
        sHunter.socket.on('musicVote', sHunter.evt.musicVote);
        sHunter.socket.on('musicAdd', sHunter.evt.musicAdd);
        sHunter.socket.on('update-now', sHunter.evt.UpdateNow);
        sHunter.socket.on('reconnect_attempt', () => {
            sHunter.socket.io.opts.query = {
                server: 'top5',
                station: 'jl2vwy6i-apswl5mr-onw1zw43kc'
            }
        });
        sHunter.socket.on('connect_error', function () {
            $(".show_share").html("");
            $(".toplist").html("");
            sHunter.musicsInsertList = [];
            sHunter.notifyBar('#content', 'warning', 4000, 'O Top 5 est&aacute; em manuten&ccedil;&atilde;o ou perdemos a sua conex&atilde;o, aguarde...');
        });
        sHunter.socket.on('error', () => {
            $(".show_share").html("");
            $(".toplist").html("");
            sHunter.musicsInsertList = [];
            sHunter.notifyBar('#content', 'warning', 5000, 'O Top 5 est&aacute; em manuten&ccedil;&atilde;o ou perdemos a sua conex&atilde;o, aguarde...');
        });
    },
    votar: function (_this) {
        if (sHunter.socket == null || $(_this).find(".vote").hasClass('on')) return;
        const hash = $(_this).attr("hash");
        sHunter.socket.emit('musicVote', {
            hash: hash
        });
    },
    add: function (_this) {
        if (sHunter.socket == null || $(_this).hasClass("loading") || $(_this).hasClass("block")) return;
        const hash = $(_this).attr("hash");
        const {
            check,
            by
        } = sHunter.checkInsert(hash);
        if (!check) {
            sHunter.notifyBar('.show_share', 'error', 10000, 'NÃ£o Ã© posivel inserir mais mÃºsica do(a) cantor(a) ' + by.toUpperCase() + ', ele jÃ¡ estÃ¡ presente em 4 musicas.');
        } else {
            $(_this).addClass("loading");
            setTimeout(() => {
                sHunter.socket.emit('musicAdd', {
                    hash: hash
                });
            }, 500);
            setTimeout(() => {
                $(_this).removeClass("loading");
            }, 5000);
        }
    },
    setTime: function (d) {
        const nowMy = new Date().getTime();
        const nowServ = new Date(d).getTime();
        sHunter.sTop5.diffTime = (nowMy - nowServ);
    },
    getTime: function () {
        const nowMy = new Date().getTime();
        return new Date(nowMy - sHunter.sTop5.diffTime);
    },
    comparyTime: function (d1, d2) {
        return (new Date(d1).getTime()) - (new Date(d2).getTime());
    },
    montarNomes: function (list, start = null, end = null) {
        if (list == null || list.length == 0) return "";
        let nomes = (start != null ? start : "");
        const tam = list.length;
        if (!(typeof list[0] === "object")) {
            nomes += list[0].toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                return a.toUpperCase();
            });
            let isAnd = list[0].indexOf(" & ") == -1 ? true : false;
            for (let i = 1; i < tam; i++) {
                isAnd = !isAnd ? false : ((new String(list[i])).indexOf(" & ") == -1 ? true : false);
                if (isAnd && (i + 1 == tam))
                    nomes += " & " + list[i].toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    });
                else
                    nomes += ", " + list[i].toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    });
            }
        } else {
            nomes += list[0].name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                return a.toUpperCase();
            });
            let isAnd = list[0].name.indexOf(" & ") == -1 ? true : false;
            for (let i = 1; i < tam; i++) {
                isAnd = !isAnd ? false : ((new String(list[i].name)).indexOf(" & ") == -1 ? true : false);
                if (isAnd && (i + 1 == tam))
                    nomes += " & " + list[i].name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    });
                else
                    nomes += ", " + list[i].name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    });
            }
        }
        return nomes + (end != null ? end : "");
    },
    evt: {
        MyHash: function (data) {
            sHunter.sTop5.user = data.user;
        },
        StartTop5: function (data) {
            sHunter.setTime(data.time);
            $(".toplist").html("");
            sHunter.sTop5.station = data.data;
            if (sHunter.sTop5.station.votes == null)
                sHunter.sTop5.station.votes = [];
            const _music = data.data.music;
            for (let i = 0; i < _music.length; i++) {
                sHunter.fixedMusicStruct(_music[i]);
                const music = _music[i];
                const aux = !(music.name.indexOf("(") > -1);
                $(".toplist").append('<div id="top5" hash="' + music.hash + '" onClick="sHunter.votar(this);">' +
                    '<div class="pos">' + (i + 1) + '</div>' +
                    '<img src="img/default_cover.jpg"/>' +
                    '<div class="info">' +
                    '<p class="singer">' + sHunter.montarNomes(music.singers) + '</p>' +
                    '<p class="music">' + music.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    }) + sHunter.montarNomes(music.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]") + '</p>' +
                    '</div>' +
                    '<div class="vote ' + ((music.blockVote || sHunter.sTop5.station.votes.indexOf(music.hash) > -1) ? 'on' : '') + '">' +
                    '<div class="button like">' + music.votes.like + '</div>' +
                    '<div class="progress" style="width:100%"></div>' +
                    '</div>' +
                    '</div>');
                sHunter.loadMusic(music, sHunter.showMusicTop5);
            }
            sHunter.arrumar();
        },
        EndTop5: function (data) {
            sHunter.sTop5.station.winner = data.data.winner;
            sHunter.sTop5.station.winnerInfo = data.data.winnerInfo;
            sHunter.showWinners();
        },
        blockInsert: function (data) {
            sHunter.sTop5.station.flags.blockMusic = true;
            $(".show_share").html("");
            sHunter.notifyBar('.show_share', 'error', 10000, 'Desculpe, nÃ£o Ã© possivel inserir mais musicas.');
        },
        blockVotes: function (data) {
            const music = data.data;
            for (let i = 0; i < music.length; i++) {
                if (music[i].blockVote)
                    $("#top5[hash='" + music[i].hash + "'] .vote").addClass("on");
                else
                    $("#top5[hash='" + music[i].hash + "'] .vote").removeClass("on");
            }
        },
        resetVotes: function (data) { },
        musicVote: function (data) {
            const music = data.data.music;
            const user = data.data.user;
            $("#top5[hash='" + music.hash + "'] .vote .like").html(music.votes.like);
            for (let i = 0; i < sHunter.sTop5.station.music.length; i++)
                if (music.hash == sHunter.sTop5.station.music[i].hash)
                    sHunter.sTop5.station.music[i].votes.like = music.votes.like;
            if (sHunter.sTop5.user == user)
                $("#top5[hash='" + music.hash + "'] .vote").addClass("on");
            sHunter.arrumar();
        },
        musicAdd: function (data) {
            const music = data.data;
            const aux = !(music.name.indexOf("(") > -1);
            $(".toplist").append('<div id="top5" hash="' + music.hash + '" onClick="sHunter.votar(this);">' +
                '<div class="pos">' + sHunter.sTop5.station.music.length + '</div>' +
                '<img src="img/default_cover.jpg"/>' +
                '<div class="info">' +
                '<p class="singer">' + sHunter.montarNomes(music.singers) + '</p>' +
                '<p class="music">' + music.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                    return a.toUpperCase();
                }) + sHunter.montarNomes(music.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]") + '</p>' +
                '</div>' +
                '<div class="vote ' + (music.blockVote ? '.on' : '') + '">' +
                '<div class="button like">' + music.votes.like + '</div>' +
                '<div class="progress" style="width:100%"></div>' +
                '</div>' +
                '</div>');
            sHunter.loadMusic(music, sHunter.showMusicTop5);
            sHunter.sTop5.station.music.push(music);
            sHunter.sTop5.TotalMusic = sHunter.sTop5.station.music.length;
            sHunter.arrumar();
            if ($("#top5_box[hash='" + music.hash + "']").length) {
                $("#top5_box[hash='" + music.hash + "']").remove();
            }
            sHunter.updateListInsert();
        },
        UpdateNow: function (data) {
            for (let i in sHunter.stations) {
                if (sHunter.stations[i].hash == data.hash) {
                    sHunter.loadMusic(data.music, function (m) {
                        sHunter.stations[i].live.now = m;
                        sHunter.updateStationShow(sHunter.stations[i]);
                    })
                    break;
                }
            }
        }
    },
    showMusicTop5: function (music) {
        if (music == null) return;
        $("#top5[hash='" + music.hash + "'] img").attr("src", music.thumb ? music.thumb["MDPI"] : sHunter.imgDefault);
    },
    showWinners: function () {
        $(".topwinlist").html("");
        for (let i = 0; i < sHunter.sTop5.station.winner.length; i++) {
            const music = sHunter.sTop5.station.winner[i];
            if (music == null) continue;
            const aux = !(music.name.indexOf("(") > -1);
            $(".topwinlist").append('<div id="wtop5" hash="' + music.hash + '">' +
                '<div class="pos">' + (i + 1) + '</div>' +
                '<img src="img/default_cover.jpg"/>' +
                '<div class="info">' +
                '<p class="singer">' + sHunter.montarNomes(music.singers) + '</p>' +
                '<p class="music">' + music.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                    return a.toUpperCase();
                }) + sHunter.montarNomes(music.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]") + '</p>' +
                '</div>' +
                '<div class="vote on">' +
                '<div class="button like">' + music.votes.like + '</div>' +
                '<div class="progress" style="width:100%"></div>' +
                '</div>' +
                '</div>');
            sHunter.loadMusic(music, (_m) => {
                $("#wtop5[hash='" + _m.hash + "'] img").attr("src", _m.thumb ? _m.thumb["MDPI"] : sHunter.imgDefault);
            });
        }
    },
    updateListInsert: function () {
        for (let i = 0; i < sHunter.musicsInsertList.length; i++) {
            if ($("#top5_box[hash='" + sHunter.musicsInsertList[i].hash + "']").length) {
                const {
                    check
                } = sHunter.checkInsert(sHunter.musicsInsertList[i].hash);
                if (!check)
                    $("#top5_box[hash='" + sHunter.musicsInsertList[i].hash + "']").addClass("block");
            }
        }
    },
    notifyBar: function (div, type, time, msg) {
        $('<div id="alert" class="' + type + '" >' + msg + '</div>').prependTo(div).delay(time).fadeOut(1000, function () {
            $(this).remove();
        });
    },
    musicsInsertList: [],
    getListInsert: function (hash) {
        for (let i = 0; i < sHunter.musicsInsertList.length; i++)
            if (sHunter.musicsInsertList[i].hash == hash)
                return sHunter.musicsInsertList[i];
        return null;
    },
    checkSinger: function (hash, limit = 4, end = null) {
        const _musics = sHunter.sTop5.station.music;
        end = (end == null || end > _musics.length || end < 0) ? _musics.length : end;
        let tot = 0;
        for (let i = 0; i < end; i++) {
            for (let s = 0; s < _musics[i].singers.length; s++)
                if (_musics[i].singers[s].hash == hash)
                    tot++;
            if ((_musics[i].feats.length == 1) && (_musics[i].feats[0].hash == hash)) {
                tot++;
            }
        }
        return !!(tot < limit);
    },
    checkMusic: function (music, pos) {
        let check = true;
        for (let s = 0; check && s < music.singers.length; s++) {
            if (!sHunter.checkSinger(music.singers[s].hash, 2, pos)) {
                check = false;
            }
        }
        if (check && (music.feats != null && music.feats.length == 1) && (!sHunter.checkSinger(music.feats[0].hash, 2, pos))) {
            check = false;
        }
        return check;
    },
    checkInsert: function (hash) {
        const _music = sHunter.getListInsert(hash);
        let check = true;
        let by = null;
        for (let s = 0; check && s < _music.singers.length; s++) {
            if (!sHunter.checkSinger(_music.singers[s].hash)) {
                check = false;
                by = _music.singers[s].name;
            }
        }
        if (check && (_music.feats.length == 1) && (!sHunter.checkSinger(_music.feats[0].hash))) {
            check = false;
            by = _music.feats[0].name;
        }
        return {
            check,
            by
        };
    },
    showHistory: function (station, data) {
        if (data == null)
            return $(".load").hide();
        $(".load").show();
        for (let i in data) {
            const _m = data[i];
            const aux = !(_m.name.indexOf("(") > -1);
            const singer = sHunter.montarNomes(_m.singers);
            const musicName = _m.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                return a.toUpperCase();
            }) + sHunter.montarNomes(_m.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]");
            const thumb = _m.thumb ? _m.thumb["HDPI"] : sHunter.imgDefault;
            const date = new Date(_m.date_history);
            $(".list").append('<div class="mbox" hash="' + _m.hash + '" date="' + _m.date_history + '">' +
                '<div class="date">' +
                '<p class="time">' + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ':' + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + '</p>' +
                '<p class="day">' + (date.getDay() < 10 ? "0" + date.getDay() : date.getDay()) + '-' + (date.getMonth() < 10 ? "0" + date.getMonth() : date.getMonth()) + '-' + (date.getFullYear() < 10 ? "0" + date.getFullYear() : date.getFullYear()) + '</p>' +
                '</div>' +
                '<img src="' + thumb + '"/>' +
                '<div class="info">' +
                '<p class="singer">' + singer + '</p>' +
                '<p class="music">' + musicName + '</p>' +
                '</div>' +
                '</div>');
        }
    },
    showStations: function () {
        const create = ($(".stations_list").length > 0);
        for (let i in sHunter.stations) {
            const _s = sHunter.stations[i];
            const _m = _s.live.now;
            const aux = !(_m.name.indexOf("(") > -1);
            const singer = sHunter.montarNomes(_m.singers);
            const musicName = _m.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                return a.toUpperCase();
            }) + sHunter.montarNomes(_m.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]");
            const thumb = _m.thumb ? _m.thumb["HDPI"] : sHunter.imgDefault;
            if (create && $(".stations_list ." + _s.url).length == 0) {
                $(".stations_list").append('<div class="live ' + _s.url + '">' +
                    '<div class="cover radio-cover">' +
                    '<img src="' + thumb + '" />' +
                    '</div>' +
                    '<div class="info">' +
                    '<p class="singer">' + singer + '</p>' +
                    '<p class="music">' + musicName + '</p>' +
                    '</div>' +
                    '<a class="play" title="Ouvir ao vivo" href="https://hunter.fm/' + _s.url + '" target="_blank"></a>' +
                    '</div>');
                if ($(".history .stations").length > 0) {
                    $(".history .stations").append('<option value="' + _s.hash + '">' + _s.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
                        return a.toUpperCase();
                    }) + '</option>');
                }
            } else {
                $("." + _s.url + " .info .singer").html(singer);
                $("." + _s.url + " .info .music").html(musicName);
                $("." + _s.url + " .radio-cover img").attr("src", thumb);
            }
            sHunter.loadMusic(_m, function (m) {
                _s.live.now = m;
                sHunter.updateStationShow(_s);
            })
        }
    },
    updateStationShow: function (_s) {
        const _m = _s.live.now;
        const aux = !(_m.name.indexOf("(") > -1);
        $("." + _s.url + " .info .singer").html(sHunter.montarNomes(_m.singers));
        $("." + _s.url + " .info .music").html(_m.name.toLowerCase().replace(/(?:^|\s)\S/g, function (a) {
            return a.toUpperCase();
        }) + sHunter.montarNomes(_m.feats, aux ? " (feat. " : " [feat. ", aux ? ")" : "]"));
        $("." + _s.url + " .radio-cover img").attr("src", _m.thumb ? _m.thumb["HDPI"] : sHunter.imgDefault);
    },
    slideStations: function (pos = 0) {
        if (!sHunter.stations) return setTimeout(function () {
            sHunter.slideStations(pos);
        }, 5000);
        if (pos >= sHunter.stations.length) pos = 0;
        const position = pos * -115;
        $(".stations_list .live").css({
            'position': 'relative'
        }).animate({
            'top': position + 'px'
        });
        setTimeout(function () {
            sHunter.slideStations(pos + 1);
        }, 15000);
    },
    loadStations: function () {
        sHunter.stations = sHunter.getStationAll();
        fetch(sHunter.url.api + "/stations", {
            method: 'GET'
        }).then((response) => {
            if (!response.ok) {
                throw new Error('Bad status code from server.');
            }
            return response.json();
        }).then((data) => {
            sHunter.stations = data;
            for (let i in sHunter.stations) {
                for (let s in sHunter.stations[i].stream)
                    sHunter.stations[i].stream[s].name = sHunter.stations[i].stream[s].bitrate + "Kbps";
                sHunter.saveStation(sHunter.stations[i]);
            }
            sHunter.showStations();
        }).catch((err) => { });
    },
    fixedMusicStruct: function (m) {
        m.name = (typeof m.name === 'undefined') ? "" : m.name;
        m.hash = (typeof m.hash === 'undefined') ? "" : m.hash;
        m.singers = (typeof m.singers === 'undefined') ? [] : m.singers;
        m.feats = (typeof m.feats === 'undefined') ? [] : m.feats;
        m.blockVote = (typeof m.blockVote === 'undefined') ? true : m.blockVote;
    },
    loadMusic: async function (m, callback = function (m) { }) {
        if (m.hash == null) {
            callback(m);
            return m;
        }
        let music = sHunter.getMusic(m.hash);
        if (music != null && music.thumb != null) {
            music = Object.assign(m, music);
            callback(music);
            return music;
        } else {
            music = m;
        }
        await fetch(sHunter.url.api + "/music/" + m.hash, {
            method: 'GET'
        }).then((response) => {
            if (!response.ok) {
                throw new Error('Bad status code from server.');
            }
            return response.json();
        }).then((data) => {
            music = Object.assign(music, data);
            sHunter.saveMusic(data);
        }).catch((err) => { });
        callback(music);
        return music;
    },
    loadHistory: function (station, last = null) {
        if (station.hash == null) {
            return;
        }
        fetch(sHunter.url.api + "/station/" + station.hash + "/history" + (last ? "?last=" + last : ""), {
            method: 'GET'
        }).then((response) => {
            if (!response.ok) {
                throw new Error('Bad status code from server.');
            }
            return response.json();
        }).then((data) => {
            sHunter.showHistory(station, data);
        }).catch((err) => { });
    },
    db: null,
    createLocalStorage: function () {
        sHunter.db = new localStorageDB("htPageOLD", localStorage);
        let isNew = sHunter.db.isNew();
        let reconnet = false;
        if (!isNew && (!sHunter.db.tableExists("dbConfig") || sHunter.getDBVersion() != sHunter.DBVersion)) {
            sHunter.db.drop();
            sHunter.db.commit();
            isNew = true;
            reconnet = true;
        }
        if (isNew) {
            if (reconnet)
                sHunter.db = new localStorageDB("htPageOLD", localStorage);
            sHunter.db.createTable("station", ["hash", "name", "url", "color", "img", "background", "stream", "top5"]);
            sHunter.db.createTable("music", ["hash", "name", "singers", "feats", "thumb", "background", "file", "video", "srt", "url", "url_buy", "url_ytmusic", "url_ytvideo", "genre"]);
            sHunter.db.createTable("dbConfig", ["version", "name"]);
            sHunter.db.createTable("siteconfig", ["id", "bgvideo", "bgimg"]);
            sHunter.db.commit();
            sHunter.db.insertOrUpdate("dbConfig", {
                name: "testeAinda"
            }, {
                version: sHunter.DBVersion,
                name: "testeAinda"
            });
            sHunter.db.commit();
        } else { }
    },
    getDBVersion: function () {
        try {
            const res = sHunter.db.queryAll("dbConfig", {
                query: {
                    name: "testeAinda"
                }
            });
            return (res.length > 0 && !!res[0]) ? res[0].version : 0;
        } catch {
            return 0;
        }
    },
    saveStation: function (station) {
        try {
            sHunter.db.insertOrUpdate("station", {
                hash: station.hash
            }, station);
            sHunter.db.commit();
        } catch { }
    },
    getStation: function (url, hash = null) {
        let query = {};
        if (url != null) {
            query.url = url;
        }
        if (hash != null) {
            query.hash = hash;
        }
        try {
            const res = sHunter.db.queryAll("station", {
                query: query
            });
            return (res.length == 0) ? null : res[0];
        } catch {
            return null;
        }
    },
    getStationAll: function () {
        try {
            const res = sHunter.db.queryAll("station", {});
            return (res.length == 0) ? null : res[0];
        } catch {
            return null;
        }
    },
    saveMusic: function (music) {
        try {
            sHunter.db.insertOrUpdate("music", {
                hash: music.hash
            }, music);
            sHunter.db.commit();
        } catch { }
    },
    getMusic: function (hash = null) {
        try {
            const res = sHunter.db.queryAll("music", {
                query: {
                    hash: hash
                }
            });
            return (res.length == 0) ? null : res[0];
        } catch {
            return null;
        }
    },
};
$(window).load(function () {
    sHunter.run();
});