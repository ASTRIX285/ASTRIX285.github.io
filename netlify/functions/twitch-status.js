exports.handler = async function(event, context) {
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const CHANNEL = 'astrix285x';

  try {
    // Get app access token
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Check if live
    const streamRes = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${CHANNEL}`,
      {
        headers: {
          'Client-ID': CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    const streamData = await streamRes.json();
    const isLive = streamData.data && streamData.data.length > 0;
    const stream = isLive ? streamData.data[0] : null;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        live: isLive,
        game: stream ? stream.game_name : null,
        title: stream ? stream.title : null,
        viewers: stream ? stream.viewer_count : null
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ live: false, error: err.message })
    };
  }
};
