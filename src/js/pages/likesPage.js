/* globals _gaq, chrome, alert */
/* globals GetPosts, GetLikes, likes, instaDefOptions */
/* jshint -W106 */

window.onload = function () {

  'use strict';

  var data;

  document.getElementById('start').onclick = function () {

    var instaPosts =
      new GetPosts({
        pageSize: likes.pageSize,
        mode: 'likeProfile',
        updateStatusDiv: likes.updateStatusDiv,
        end_cursor: null,
        vueStatus: likes,
        userName: likes.userToGetLikes,
        userId: likes.viewerUserName === likes.userToGetLikes ? likes.viewerUserId : ''
      });

    instaPosts.resolveUserName().then(() => {

      data = new Map();

      likes.startDate = (new Date()).toLocaleTimeString();
      likes.fetchedPosts = 0;
      likes.processedPosts = 0;
      likes.totalPosts = 0;
      likes.stop = false;
      likes.log = '';
      likes.allPostsFetched = false;

      likes.isInProgress = true;

      likes.updateStatusDiv(`The interval between the requests is ${likes.delay}ms`);

      getPosts(instaPosts, true);

    }, () => {
      alert('Specified user was not found');
      instaPosts = null;
    });
  };

  function getPosts(instaPosts, restart) {
    instaPosts.getPosts(restart).then(media => {

      likes.fetchedPosts += media.length;
      likes.totalPosts = instaPosts.getTotal();

      getLikes(instaPosts, media, 0);

    }).catch(e => {
      likes.updateStatusDiv(e.toString());
    });
  }

  function formatDate(date) {
    var d = date.getDate();
    var m = date.getMonth() + 1;
    var y = date.getFullYear();
    return '' + y + '-' + (m<=9 ? '0' + m : m) + '-' + (d <= 9 ? '0' + d : d);
  }

  function whenCompleted() {
    likes.updateStatusDiv(`Started at ${likes.startDate}`);
    likes.updateStatusDiv(`Fetched ${likes.fetchedPosts} posts`);

    likes.isInProgress = false;
    //likes.log = JSON.stringify([...data]);

    __items.length = 0;
    Array.from(data.values()).forEach(e => {
      //convert dates
      e.diff = Math.round((e.lastLike - e.firstLike) / 60 / 60 / 24);
      e.lastLike = formatDate(new Date(e.lastLike * 1000));
      e.firstLike = formatDate(new Date(e.firstLike * 1000));
      __items.push(e);
    });

  }

  function getLikes(instaPosts, media, index) {
    if (likes.isCompleted) {
      return whenCompleted();
    }

    if (media.length > index) { //we still have something to get
      var obj = media[index];
      var url = obj.node.display_url;
      var taken = new Date(obj.node.taken_at_timestamp * 1000).toLocaleString();
      var shortcode = obj.node.shortcode;
      likes.totalLikes = obj.node.edge_media_preview_like.count;
      likes.processedLikes = 0;
      likes.updateStatusDiv(`Post ${url} taken on ${taken} has ${likes.totalLikes} likes`);

      var instaLike = new GetLikes({
        shortCode: shortcode,
        end_cursor: '',
        updateStatusDiv: likes.updateStatusDiv,
        pageSize: instaDefOptions.defPageSizeForLikes, //TODO: parametrize
        vueStatus: likes
      });

      getPostLikes(instaLike, instaPosts, media, index, obj.node.taken_at_timestamp);

    } else if (instaPosts.hasMore()) { //do we still have something to fetch
      likes.updateStatusDiv(`The more posts will be fetched now...${new Date()}`);
      setTimeout(() => getPosts(instaPosts, false), likes.delay);
    } else { // nothing more found in profile
      likes.allPostsFetched = true;
      setTimeout(() => getLikes(instaPosts, media, ++index), 0);
    }
  }

  function getPostLikes(instaLike, instaPosts, media, index, taken) {
    if (likes.isCompleted) {
      return whenCompleted();
    }

    instaLike.getLikes().then(result => {
      likes.updateStatusDiv(`... fetched information about ${result.length} likes`);
      for (var i = 0; i < result.length; i++) {
        var userId = result[i].node.id;
        var userName = result[i].node.username;
        var fullName = result[i].node.full_name;
        var url = result[i].node.profile_pic_url;
        if (data.has(userId)) {
          var obj = data.get(userId);
          obj.count++;
          if (taken > obj.lastLike) {
            obj.lastLike = taken;
          } else if (taken < obj.firstLike) {
            obj.firstLike = taken;
          }
          data.set(userId, obj);
        } else {
          data.set(userId, { userName: userName, count: 1, lastLike: taken, firstLike: taken, fullName: fullName, url: url });
        }
        likes.processedLikes += 1;
      }
      if (instaLike.hasMore()) {
        setTimeout(() => getPostLikes(instaLike, instaPosts, media, index, taken), likes.delay);
      } else {
        instaLike = null;
        likes.processedPosts += 1;
        setTimeout(() => getLikes(instaPosts, media, ++index), likes.delay);
      }
    });

  }

  chrome.runtime.onMessage.addListener(function (request) {
    if (request.action === 'openLikesPage') {

      likes.delay = request.likeDelay;

      likes.viewerUserName = request.viewerUserName;
      likes.viewerUserId = request.viewerUserId;

      likes.pageSize = request.pageSizeForFeed; //is not binded

      likes.userToGetLikes = request.userName === instaDefOptions.you ? request.viewerUserName : request.userName;

    }
  });

  _gaq.push(['_trackPageview']);

};

