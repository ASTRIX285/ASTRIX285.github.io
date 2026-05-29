import json, urllib.request, urllib.parse, os, sys, re
from datetime import datetime

API_KEY    = os.environ['YOUTUBE_API_KEY']
BASE       = 'https://www.googleapis.com/youtube/v3'
CHANNEL_ID = 'UCrKaDvstd-YzsD0ZQ6ldFrw'

PLAYLISTS = [
    {'game': 'crimson-desert', 'label': 'Crimson Desert', 'id': 'PLYwP61l5jB7RKcMiDhH34xc1JpZg3xrGi'},
    # Add more here as you create them:
    # {'game': 'warframe',       'label': 'Warframe',       'id': 'PLxxxxxxx'},
    # {'game': 'borderlands',    'label': 'Borderlands',    'id': 'PLxxxxxxx'},
    # {'game': 'destiny',        'label': 'Destiny 2',      'id': 'PLxxxxxxx'},
]

def api_get(endpoint, params):
    params['key'] = API_KEY
    url = BASE + '/' + endpoint + '?' + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f'API error: {e}', file=sys.stderr)
        return None

def parse_duration(iso):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso or 'PT0S')
    if not m:
        return '0:00'
    h = int(m.group(1) or 0)
    mn = int(m.group(2) or 0)
    s = int(m.group(3) or 0)
    total = h * 3600 + mn * 60 + s
    mn2, s2 = divmod(total, 60)
    h2, mn2 = divmod(mn2, 60)
    if h2:
        return f'{h2}:{mn2:02d}:{s2:02d}'
    return f'{mn2}:{s2:02d}'

def detect_type(title, desc):
    c = (title + ' ' + desc).lower()
    if any(w in c for w in ['boss', 'kill', 'fight', 'defeated', 'strategy']):
        return 'boss-kill'
    if any(w in c for w in ['funny', 'lol', 'fail', 'oops', 'unexpected', 'wtf']):
        return 'funny'
    if any(w in c for w in ['pvp', ' vs ', 'versus', 'duel', 'pk']):
        return 'pvp'
    if any(w in c for w in ['build', 'guide', 'how to', 'tutorial', 'tips', 'setup']):
        return 'build'
    return 'highlight'

# Fetch all clips
all_clips = []
for pl in PLAYLISTS:
    print(f'Fetching: {pl["label"]} ({pl["id"]})')
    data = api_get('playlistItems', {
        'part': 'snippet,contentDetails',
        'playlistId': pl['id'],
        'maxResults': 50,
    })
    if not data or 'items' not in data:
        print(f'  No items found')
        continue

    video_ids = [
        item['contentDetails']['videoId']
        for item in data['items']
        if item.get('contentDetails', {}).get('videoId')
    ]
    if not video_ids:
        continue

    details = api_get('videos', {
        'part': 'contentDetails,snippet,statistics',
        'id': ','.join(video_ids),
    })
    detail_map = {}
    if details and 'items' in details:
        for v in details['items']:
            detail_map[v['id']] = v

    for item in data['items']:
        vid = item.get('contentDetails', {}).get('videoId')
        if not vid:
            continue
        snippet = item.get('snippet', {})
        title = snippet.get('title', 'Untitled')
        desc = snippet.get('description', '')
        if title in ('Deleted video', 'Private video'):
            continue
        pub_raw = snippet.get('publishedAt', '')
        try:
            pub_str = datetime.strptime(pub_raw[:10], '%Y-%m-%d').strftime('%b %d, %Y')
        except:
            pub_str = ''
        detail = detail_map.get(vid, {})
        iso_dur = detail.get('contentDetails', {}).get('duration', 'PT0S')
        duration = parse_duration(iso_dur)
        clip_type = detect_type(title, desc)
        all_clips.append({
            'id': vid, 'title': title, 'game': pl['game'],
            'label': pl['label'], 'type': clip_type,
            'date': pub_str, 'duration': duration,
        })
        print(f'  OK: {title} [{clip_type}] {duration}')

print(f'\nTotal clips: {len(all_clips)}')

# Build game filter buttons
game_btns = '        <button class="filter-btn active" data-game="all" onclick="filterClips(this,\'game\')">All</button>\n'
for pl in PLAYLISTS:
    game_btns += f'        <button class="filter-btn" data-game="{pl["game"]}" onclick="filterClips(this,\'game\')">{pl["label"]}</button>\n'

# Build clip cards
def clip_card(clip, idx):
    delay = '' if idx % 3 == 0 else f' reveal-delay-{idx % 3}'
    thumb = f'https://img.youtube.com/vi/{clip["id"]}/maxresdefault.jpg'
    fallback = f'../img/games/{clip["game"].replace("-","")}.jpg'
    modal_title = f'{clip["label"]} \u2014 {clip["title"]}'
    modal_source = f'{clip["label"]} \u00b7 {clip["type"].replace("-"," ").title()} \u00b7 via Eklipse.gg'
    type_label = clip['type'].replace('-', ' ').title()
    return f'''
      <div class="clip-card reveal{delay}" data-game="{clip["game"]}" data-type="{clip["type"]}">
        <div class="clip-thumb" onclick="openClip('{clip["id"]}','{modal_title}','{modal_source}')">
          <img src="{thumb}" alt="{clip["title"]}" onerror="this.src='{fallback}'">
          <div class="clip-thumb-overlay">
            <div class="clip-play-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="clip-game-badge">{clip["label"]}</div>
          <div class="clip-type-badge">{type_label}</div>
          <div class="clip-duration">{clip["duration"]}</div>
          <div class="clip-source">EKLIPSE.GG</div>
        </div>
        <div class="clip-body">
          <div class="clip-title">{clip["title"]}</div>
          <div class="clip-meta">
            <span class="clip-date">{clip["date"]}</span>
            <div class="clip-links">
              <a href="https://www.youtube.com/watch?v={clip["id"]}" target="_blank" class="clip-link">YouTube &#8599;</a>
              <a href="https://eklipse.gg" target="_blank" class="clip-link eklipse">&#9889; Eklipse</a>
            </div>
          </div>
        </div>
      </div>'''

cards_html = '\n'.join(clip_card(c, i) for i, c in enumerate(all_clips))
if not cards_html:
    cards_html = '''
      <div class="clips-empty">
        <div class="clips-empty-icon">&#127918;</div>
        <div class="clips-empty-text">No clips yet &mdash; check back after the next stream</div>
      </div>'''

clip_count = len(all_clips)

html = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clips &amp; Highlights | ASTRIX285</title>
  <link rel="stylesheet" href="../css/style.css">
  <style>
    .clips-hero{padding:calc(var(--nav-height) + 60px) 40px 60px;background:var(--dark-2);border-bottom:1px solid rgba(139,0,0,0.2);position:relative;overflow:hidden}
    .clips-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 80% 50%,rgba(139,0,0,0.15) 0%,transparent 60%)}
    .filter-bar{display:flex;gap:0;flex-wrap:wrap;border-bottom:1px solid rgba(139,0,0,0.2)}
    .filter-section{display:flex;gap:0;flex-wrap:wrap;padding:16px 0}
    .filter-section+.filter-section{border-left:1px solid rgba(139,0,0,0.2);padding-left:16px;margin-left:16px}
    .filter-label{font-family:"Orbitron",monospace;font-size:8px;letter-spacing:3px;color:var(--grey-dark);text-transform:uppercase;display:flex;align-items:center;padding-right:12px}
    .filter-btn{font-family:"Orbitron",monospace;font-size:9px;letter-spacing:2px;padding:6px 16px;border:1px solid transparent;color:var(--grey);cursor:pointer;text-transform:uppercase;transition:all 0.2s;background:transparent}
    .filter-btn:hover{color:var(--white);border-color:rgba(139,0,0,0.4)}
    .filter-btn.active{color:var(--white);background:rgba(139,0,0,0.15);border-color:var(--crimson)}
    .filter-btn.type-btn.active{color:var(--gold);border-color:var(--gold);background:rgba(201,168,76,0.08)}
    .clips-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:2px}
    .clip-card{background:var(--dark-2);border:1px solid rgba(139,0,0,0.15);overflow:hidden;transition:border-color 0.3s;position:relative}
    .clip-card:hover{border-color:rgba(139,0,0,0.4)}
    .clip-card.hidden{display:none}
    .clip-thumb{aspect-ratio:16/9;position:relative;background:#000;cursor:pointer;overflow:hidden}
    .clip-thumb img{width:100%;height:100%;object-fit:cover;transition:transform 0.4s}
    .clip-card:hover .clip-thumb img{transform:scale(1.04)}
    .clip-thumb-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 50%);display:flex;align-items:center;justify-content:center}
    .clip-play-btn{width:56px;height:56px;border-radius:50%;background:rgba(139,0,0,0.9);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;transition:transform 0.2s,background 0.2s}
    .clip-card:hover .clip-play-btn{transform:scale(1.12);background:var(--crimson-mid)}
    .clip-play-btn svg{margin-left:4px}
    .clip-game-badge{position:absolute;top:10px;left:10px;font-family:"Orbitron",monospace;font-size:8px;letter-spacing:2px;color:var(--white);background:var(--crimson);padding:3px 10px;text-transform:uppercase}
    .clip-type-badge{position:absolute;top:10px;right:10px;font-family:"Orbitron",monospace;font-size:8px;letter-spacing:2px;color:var(--dark);background:var(--gold);padding:3px 10px;text-transform:uppercase}
    .clip-duration{position:absolute;bottom:10px;right:10px;font-family:"Orbitron",monospace;font-size:9px;color:var(--white);background:rgba(0,0,0,0.8);padding:2px 8px;letter-spacing:1px}
    .clip-source{position:absolute;bottom:10px;left:10px;font-family:"Orbitron",monospace;font-size:7px;letter-spacing:2px;color:rgba(255,255,255,0.6)}
    .clip-source::before{content:"⚡";font-size:10px;color:var(--gold);margin-right:4px}
    .clip-body{padding:16px 20px}
    .clip-title{font-family:"Orbitron",monospace;font-size:12px;font-weight:600;color:var(--white);line-height:1.4;margin-bottom:8px;letter-spacing:0.5px}
    .clip-meta{display:flex;justify-content:space-between;align-items:center}
    .clip-date{font-size:11px;color:var(--grey-dark);letter-spacing:1px}
    .clip-links{display:flex;gap:10px}
    .clip-link{font-family:"Orbitron",monospace;font-size:8px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;text-decoration:none;transition:color 0.2s}
    .clip-link:hover{color:var(--gold-light)}
    .clip-link.eklipse{color:var(--grey-dark)}
    .clip-link.eklipse:hover{color:var(--grey)}
    .clip-modal{display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);align-items:center;justify-content:center}
    .clip-modal.open{display:flex}
    .clip-modal-inner{position:relative;width:92vw;max-width:1100px}
    .clip-modal-close{position:absolute;top:-44px;right:0;font-family:"Orbitron",monospace;font-size:10px;letter-spacing:2px;color:var(--grey);background:none;border:none;cursor:pointer;text-transform:uppercase}
    .clip-modal-close:hover{color:var(--white)}
    .clip-modal-frame{position:relative;padding-top:56.25%;background:#000}
    .clip-modal-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:none}
    .clip-modal-label{font-family:"Orbitron",monospace;font-size:10px;letter-spacing:2px;color:var(--grey);text-align:center;margin-top:16px;text-transform:uppercase}
    .clip-modal-source{font-family:"Orbitron",monospace;font-size:8px;letter-spacing:2px;color:var(--gold);text-align:center;margin-top:6px}
    .clips-empty{text-align:center;padding:80px 40px;grid-column:1 / -1}
    .clips-empty-icon{font-size:48px;margin-bottom:20px;opacity:0.3}
    .clips-empty-text{font-family:"Orbitron",monospace;font-size:11px;letter-spacing:3px;color:var(--grey-dark);text-transform:uppercase}
    .clips-stats{display:flex;gap:24px;align-items:center;padding:12px 0;font-family:"Orbitron",monospace;font-size:9px;letter-spacing:2px;color:var(--grey-dark);border-bottom:1px solid rgba(139,0,0,0.1);margin-bottom:24px;flex-wrap:wrap}
    .clips-stats span{color:var(--crimson-mid)}
    @media(max-width:768px){.clips-hero{padding:calc(var(--nav-height) + 40px) 20px 40px}.clips-grid{grid-template-columns:1fr}.filter-section+.filter-section{border-left:none;border-top:1px solid rgba(139,0,0,0.2);padding-left:0;margin-left:0}.filter-bar{flex-direction:column}}
  </style>
</head>
<body>
<nav class="nav">
  <div class="nav-logo">
    <img src="../img/logo.png" alt="ASTRIX285">
    <span>ASTRIX<span class="accent">285</span></span>
  </div>
  <button class="nav-toggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>
  <div class="nav-links">
    <a href="../index.html">Home</a>
    <a href="reviews.html">Reviews</a>
    <a href="news.html">News</a>
    <a href="clips.html" class="active">Clips</a>
    <a href="games.html">Universes</a>
    <a href="join.html">Join Us</a>
  </div>
  <div class="nav-live">
    <div class="nav-live-dot" id="navDot"></div>
    <span class="nav-live-text" id="navText">OFFLINE</span>
  </div>
</nav>

<div class="clips-hero">
  <div style="max-width:1100px;margin:0 auto;position:relative;z-index:1;">
    <div class="section-eyebrow" style="animation:fadeUp 0.8s ease 0.2s both;">&#9889; Powered by Eklipse.gg</div>
    <h1 class="section-title" style="animation:fadeUp 0.8s ease 0.4s both;">Clips &amp; <span class="accent">Highlights</span></h1>
    <p style="color:var(--grey);max-width:500px;margin-top:16px;animation:fadeUp 0.8s ease 0.6s both;">The best moments from every stream &mdash; auto-captured by Eklipse.gg and published straight here.</p>
    <div style="display:flex;gap:16px;margin-top:24px;animation:fadeUp 0.8s ease 0.8s both;flex-wrap:wrap;">
      <a href="https://www.youtube.com/@ASTRIXPARADOX" target="_blank" class="btn-primary" style="font-size:10px;padding:10px 24px;">&#9654; &nbsp; YouTube Channel &#8599;</a>
      <a href="https://eklipse.gg" target="_blank" class="btn-secondary" style="font-size:10px;padding:10px 24px;">&#9889; Eklipse.gg &#8599;</a>
    </div>
  </div>
</div>

<div class="gold-line"></div>

<section style="background:var(--dark-2);padding:0 40px;">
  <div style="max-width:1100px;margin:0 auto;">
    <div class="filter-bar">
      <div class="filter-section">
        <span class="filter-label">Game</span>
''' + game_btns + '''      </div>
      <div class="filter-section">
        <span class="filter-label">Type</span>
        <button class="filter-btn type-btn active" data-type="all" onclick="filterClips(this,'type')">All</button>
        <button class="filter-btn type-btn" data-type="highlight" onclick="filterClips(this,'type')">Highlight</button>
        <button class="filter-btn type-btn" data-type="boss-kill" onclick="filterClips(this,'type')">Boss Kill</button>
        <button class="filter-btn type-btn" data-type="funny" onclick="filterClips(this,'type')">Funny</button>
        <button class="filter-btn type-btn" data-type="pvp" onclick="filterClips(this,'type')">PvP</button>
        <button class="filter-btn type-btn" data-type="build" onclick="filterClips(this,'type')">Build</button>
      </div>
    </div>
  </div>
</section>

<section class="section" style="background:var(--dark);padding-top:32px;">
  <div style="max-width:1100px;margin:0 auto;">
    <div class="clips-stats">
      SHOWING <span id="clipCount">''' + str(clip_count) + '''</span> CLIPS
      &nbsp;&middot;&nbsp; &#9889; AUTO-GENERATED BY EKLIPSE.GG
      &nbsp;&middot;&nbsp; <a href="https://www.youtube.com/@ASTRIXPARADOX" target="_blank" style="color:var(--crimson-mid);font-family:'Orbitron',monospace;font-size:9px;letter-spacing:2px;">SUBSCRIBE ON YOUTUBE &#8599;</a>
    </div>
    <div class="clips-grid" id="clipsGrid">
''' + cards_html + '''
    </div>
  </div>
</section>

<footer class="footer">
  <div class="footer-social">
    <a href="https://x.com/ASTRIX285" target="_blank">X / Twitter</a>
    <a href="https://discord.com/invite/6dcyrbpdzN" target="_blank">Discord</a>
    <a href="https://www.twitch.tv/astrix285x" target="_blank">Twitch</a>
    <a href="https://www.facebook.com/xASTRIX285x" target="_blank">Facebook</a>
    <a href="https://www.youtube.com/c/ASTRIX285Gaming" target="_blank">YouTube</a>
  </div>
  <div class="gold-line" style="margin-bottom:20px;"></div>
  <div class="footer-copy">&copy; 2025 Astrix285 &mdash; Built for the community, powered by gaming passion and history.</div>
  <div class="footer-disclaimer">Clips auto-generated with Eklipse.gg AI highlight technology.</div>
</footer>

<div class="clip-modal" id="clipModal">
  <div class="clip-modal-inner">
    <button class="clip-modal-close" onclick="closeClip()">&#10005; Close</button>
    <div class="clip-modal-frame">
      <iframe id="clipFrame" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    </div>
    <div class="clip-modal-label" id="clipLabel"></div>
    <div class="clip-modal-source" id="clipSource"></div>
  </div>
</div>

<script src="../js/main.js"></script>
<script>
  var activeGame='all',activeType='all';
  function filterClips(btn,dim){
    document.querySelectorAll(dim==='game'?'[data-game].filter-btn':'[data-type].filter-btn').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    if(dim==='game')activeGame=btn.dataset.game;
    if(dim==='type')activeType=btn.dataset.type;
    var count=0;
    document.querySelectorAll('.clip-card').forEach(function(card){
      var show=(activeGame==='all'||card.dataset.game===activeGame)&&(activeType==='all'||card.dataset.type===activeType);
      card.classList.toggle('hidden',!show);
      if(show)count++;
    });
    document.getElementById('clipCount').textContent=count;
  }
  function openClip(id,label,source){
    document.getElementById('clipFrame').src='https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';
    document.getElementById('clipLabel').textContent=label;
    document.getElementById('clipSource').textContent=source;
    document.getElementById('clipModal').classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeClip(){
    document.getElementById('clipFrame').src='';
    document.getElementById('clipModal').classList.remove('open');
    document.body.style.overflow='';
  }
  document.getElementById('clipModal').addEventListener('click',function(e){if(e.target===this)closeClip()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeClip()});
</script>
</body>
</html>'''

with open('pages/clips.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'clips.html written with {clip_count} clips')
