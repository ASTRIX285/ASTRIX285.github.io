const TWITCH_CLIENT_ID = '11h0r4yfn8edb31yj227kbwzfep8lg';
const TWITCH_CLIENT_SECRET = '3zrsnmrtyzn405225on91mqoyjqh1h';
const TWITCH_CHANNEL = 'astrix285x';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // Get app access token
      const tokenRes = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
        { method: 'POST' }
      );
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const headers = {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      };

      // Get user ID first
      const userRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${TWITCH_CHANNEL}`,
        { headers }
      );
      const userData = await userRes.json();
      const userId = userData.data[0].id;

      // Check if live
      const streamRes = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
        { headers }
      );
      const streamData = await streamRes.json();
      const isLive = streamData.data && streamData.data.length > 0;
      const stream = isLive ? streamData.data[0] : null;

      // Get latest VOD
      const vodRes = await fetch(
        `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=1`,
        { headers }
      );
      const vodData = await vodRes.json();
      const latestVod = vodData.data && vodData.data.length > 0 ? vodData.data[0] : null;

      return new Response(JSON.stringify({
        live: isLive,
        game: stream ? stream.game_name : null,
        title: stream ? stream.title : null,
        viewers: stream ? stream.viewer_count : null,
        vod: latestVod ? {
          id: latestVod.id,
          title: latestVod.title,
          duration: latestVod.duration,
          url: latestVod.url,
          thumbnail: latestVod.thumbnail_url
            ? latestVod.thumbnail_url.replace('%{width}', '640').replace('%{height}', '360')
            : null
        } : null
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ live: false, vod: null, error: err.message }), { headers: corsHeaders });
    }
  }
};
