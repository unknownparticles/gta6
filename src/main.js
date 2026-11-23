import './style.css';
import { audioSystem } from './audio.js';
import { cars, days, districts, packs, paints, weapons } from './data.js';
import { icons } from './icons.js';
import { drawMap } from './map.js';
import {
  buyAmmo,
  buyPaint,
  buyWeapon,
  claimDay,
  claimPack,
  hasWeapon,
  loadSave,
  localDate,
} from './save.js';

const $ = (selector) => document.querySelector(selector);
const lobby = $('#lobby');
const play = $('#play');
const panel = $('#panel');
const content = $('#panel-content');
const rotation = $('#rotation');
const store = loadSave();
const save = store.data;
const audio = audioSystem(save.settings);
const mobilePointer = matchMedia('(pointer: coarse)');
const appleTablet =
  /iPad/i.test(navigator.userAgent) ||
  (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const handheld = appleTablet || /iPhone|iPod|Android|Mobile|Tablet/i.test(navigator.userAgent);
const touch = () => handheld || (navigator.maxTouchPoints > 0 && mobilePointer.matches);
const messages = [
  '海堤路灯正常。路灯尽头的海，请勿驾车驶入。',
  '晚钟车库今日营业。刹车与快乐均为消耗品。',
  '锈锚宣布货场禁停。盐线宣布这条公告停得很好。',
  'VIP 车手专享和游客完全相同的海风。',
];
let game;
let loading = false;
let blocked = false;
let view = '';
let details = {};
let lastFocus;
let toastTimer;
let messageIndex = 0;

function text(value) {
  const line = document.createElement('span');
  line.textContent = value == null ? '' : String(value);
  return line.innerHTML;
}
function button(label, data = '', css = '', disabled = false) {
  return (
    '<button type="button" class="action ' +
    css +
    '" ' +
    data +
    (disabled ? ' disabled' : '') +
    '>' +
    label +
    '</button>'
  );
}
function icon(name) {
  return '<i data-icon="' + name + '" aria-hidden="true"></i>';
}
function displayTime(value) {
  return Number(value).toFixed(2) + ' 秒';
}
function write() {
  if (!store.write()) toast('本机存储不可用，本次进度只保留到页面关闭。');
  refreshLobby();
}

function toast(message) {
  const node = $('#toast');
  clearTimeout(toastTimer);
  if (panel.open) {
    let line = panel.querySelector('.panel-toast');
    if (!line) {
      line = document.createElement('p');
      line.className = 'panel-toast';
      line.role = 'status';
      panel.querySelector('.panel-frame').append(line);
    }
    line.textContent = message;
    toastTimer = setTimeout(() => line.remove(), 4100);
  } else {
    node.textContent = message;
    node.hidden = false;
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 4100);
  }
}

function refreshLobby() {
  $('#player-name').textContent = save.signedIn && save.nick ? save.nick : '未登记车手';
  $('#profile-label').textContent = save.signedIn && save.id ? save.id : '模拟登录 / 注册';
  $('#vip').textContent = 'VIP ' + save.claimed.length;
  $('#coin-count').textContent = String(save.coins);
  const strip = $('#quick-days');
  strip.replaceChildren(
    ...days.map((_, index) => {
      const day = document.createElement('b');
      day.textContent = index < save.dates.length ? '✓' : String(index + 1);
      day.classList.toggle('done', index < save.dates.length);
      return day;
    }),
  );
  const ready = save.dates.length < days.length && !(save.dates.at(-1) >= localDate());
  $('.promo.sign').classList.toggle('notify', ready);
  $('.promo.recharge').classList.toggle('notify', !save.claimed.includes(0));
}

function rotationState() {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const isTouch = touch();
  const smallTouch = isTouch && (width <= height || width < 560);
  const smallDesktop = !isTouch && !play.hidden && (width < 490 || height < 280);
  const next = smallTouch || smallDesktop;
  if (next) {
    if (panel.open) panel.close();
    if (smallDesktop) {
      $('#rotation-title').textContent = '请扩大游玩窗口';
      $('#rotation-note').textContent = '拉宽窗口后可继续游玩。';
    } else {
      const tablet =
        appleTablet ||
        /Tablet/i.test(navigator.userAgent) ||
        Math.min(screen.width, screen.height) >= 700;
      $('#rotation-title').textContent = tablet ? '请旋转平板方向游玩' : '请旋转手机方向游玩';
      $('#rotation-note').textContent =
        width > height ? '当前窗口太窄。退出分屏或扩大窗口后继续。' : '把设备横过来即可进入潮汐市。';
    }
  }
  lobby.inert = next;
  play.inert = next;
  rotation.hidden = !next;
  if (next !== blocked) {
    blocked = next;
    if (!play.hidden) {
      game?.view(!next);
      if (!next && !loading && game) {
        if (['fail', 'hospital', 'mission', 'race', 'context'].includes(view))
          open(view, details, true);
        else open('pause', {}, true);
      }
    } else if (!next && view) {
      open(view, details, true);
    }
  }
  game?.resize();
}

function closePanel(continuePlay = true) {
  if (blocked || loading) return;
  view = '';
  details = {};
  panel.close();
  if (!play.hidden && continuePlay) game?.pause(false);
  else if (lastFocus && !lastFocus.closest('[hidden]') && document.contains(lastFocus))
    lastFocus.focus({ preventScroll: true });
}

const panelTitles = {
  profile: '港区身份登记',
  register: '模拟注册',
  shop: '潮票商城',
  'confirm-pack': '模拟充值',
  sign: '七日签到',
  pass: '夜班通行证',
  garage: '晚钟车库',
  armory: '武器商店',
  districts: '潮汐市街区',
  help: '操作说明',
  notice: '港务广播',
  settings: '设置',
  credits: '素材与致谢',
  more: '更多港区服务',
  pause: '游戏已暂停',
  map: '潮汐市地图',
  loading: '正在进入潮汐市',
  error: '游戏暂时无法进入',
  mission: '夜班急件 · 已交付',
  race: '海堤计时赛 · 完赛',
  fail: '本次行动中断',
  hospital: '潮汐市医院',
  context: '画面连接中断',
};

function open(name, data = {}, keepFocus = false) {
  if (name === 'hospital') {
    clearTimeout(toastTimer);
    $('#toast').hidden = true;
    panel.querySelector('.panel-toast')?.remove();
  }
  view = name;
  details = data;
  if (blocked) return;
  if (!panel.open && !keepFocus) lastFocus = document.activeElement;
  if (!play.hidden && game) game.pause(true);
  $('#panel-kicker').textContent =
    name === 'profile' || name === 'register' || name === 'confirm-pack'
      ? '本机演示'
      : '给他爱6 · GTA6';
  $('#panel-title').textContent = panelTitles[name] || '潮汐市';
  renderPanel(name, data);
  if (!panel.open) {
    panel.showModal();
    panel.querySelector('[data-panel-close]').focus({ preventScroll: true });
  }
}
const go = (name) => 'data-open="' + name + '"';
const command = (name) => 'data-action="' + name + '"';
const primary = 'hot';

function renderPanel(name, data) {
  const rows = {
    profile() {
      const greeting = save.id
        ? '<div class="tile"><b>' +
          text(save.nick) +
          '</b><small>本机试玩编号 ' +
          text(save.id) +
          '</small></div>'
        : '<p>登记一个本机试玩身份。昵称和试玩编号保存在此浏览器。</p>';
      return (
        greeting +
        '<div class="actions">' +
        (save.id ? button('模拟登录', command('login'), primary) : '') +
        button(save.id ? '修改试玩昵称' : '模拟注册', go('register'), save.id ? '' : primary) +
        button('游客开玩', command('guest')) +
        '</div>'
      );
    },
    register() {
      return (
        '<form id="profile-form"><label for="nickname">试玩昵称</label><input id="nickname" name="nickname" maxlength="16" placeholder="例如：海堤夜班车手" autocomplete="off"><p class="muted">留空时使用随机昵称，保留当前试玩进度。</p><div class="actions">' +
        '<button class="action hot">创建本机试玩身份</button>' +
        button('返回', go('profile')) +
        '</div></form>'
      );
    },
    shop() {
      return (
        '<p>潮票余额 <b>' +
        save.coins +
        '</b>。本机演示 · 实付 0 元。</p><div class="row-grid">' +
        packs
          .map(
            (pack, index) =>
              '<article class="tile"><small>标价梗 ¥' +
              pack.parody +
              '</small><strong>' +
              pack.name +
              '</strong><span>' +
              pack.slogan +
              '</span><small>' +
              pack.coins +
              ' 潮票 · ' +
              paints[pack.paint].name +
              '</small>' +
              button(
                save.claimed.includes(index) ? '已领取' : '模拟领取 · 实付 0 元',
                go('confirm-pack') + ' data-id="' + index + '"',
                primary,
                save.claimed.includes(index),
              ) +
              '</article>',
          )
          .join('') +
        '</div><h3>兑换涂装</h3><div class="row-list">' +
        Object.entries(paints)
          .filter(([, paint]) => paint.price > 0)
          .map(
            ([id, paint]) =>
              '<div class="tile"><span class="swatch" style="background:' +
              paint.color +
              '"></span><b>' +
              paint.name +
              '</b>' +
              button(
                save.skins.includes(id) ? '已拥有' : paint.price + ' 潮票兑换',
                command('buy-paint') + ' data-id="' + id + '"',
                '',
                save.skins.includes(id) || save.coins < paint.price,
              ) +
              '</div>',
          )
          .join('') +
        '</div>'
      );
    },
    'confirm-pack'() {
      const index = Number(data.id);
      const pack = packs[index];
      if (!pack) return '<p>礼包暂不可用。</p>' + button('返回商城', go('shop'));
      if (save.claimed.includes(index))
        return '<p>' + pack.name + '已领取。实付 0 元。</p>' + button('返回商城', go('shop'));
      return (
        '<div class="tile win"><b>' +
        pack.name +
        ' · 实付 0 元</b><span>' +
        pack.coins +
        ' 潮票和「' +
        paints[pack.paint].name +
        '」涂装</span><small>本机演示礼包</small></div><div class="actions">' +
        button('确认模拟领取 · 0 元', command('pack') + ' data-id="' + index + '"', primary) +
        button('返回商城', go('shop')) +
        '</div>'
      );
    },
    sign() {
      const day = save.dates.length;
      const ready = day < days.length && !(save.dates.at(-1) >= localDate());
      return (
        '<p>每天领一次，漏签顺延。累计七日可领取限定镀铬涂装。</p><div class="sign-grid">' +
        days
          .map(
            ([label], index) =>
              '<div class="tile ' +
              (index < day ? 'earned' : '') +
              '"><b>第 ' +
              (index + 1) +
              ' 天</b>' +
              icon(index === 6 ? 'crown' : 'gift') +
              '<small>' +
              label +
              '</small><small>' +
              (index < day ? '已领取' : index === day && ready ? '可领取' : '待解锁') +
              '</small></div>',
          )
          .join('') +
        '</div>' +
        button(
          day === 7 ? '七日签到已完成' : ready ? '领取今日签到' : '今日已领取',
          command('sign'),
          primary,
          !ready,
        )
      );
    },
    pass() {
      const milestones = [
        [100, '夜班学徒'],
        [500, '海堤常客'],
        [1500, '港务金牌'],
        [3000, '上岸未遂'],
      ];
      return (
        '<p>当前累计驾驶 <b>' +
        Math.floor(save.meters) +
        ' 米</b>。</p><div class="row-list">' +
        milestones
          .map(
            ([m, label]) =>
              '<div class="tile' +
              (save.meters >= m ? ' earned' : '') +
              '">' +
              icon('ticket') +
              '<b>' +
              label +
              '</b><small>' +
              (save.meters >= m ? '达成' : m + ' 米') +
              '</small></div>',
          )
          .join('') +
        '</div><p>当前模拟会员等级 VIP ' +
        save.claimed.length +
        '。已获得 ' +
        save.skins.length +
        ' 款涂装。</p>'
      );
    },
    garage() {
      const values = Object.entries(cars);
      return (
        '<div class="row-grid">' +
        values
          .map(([id, car], index) => {
            const owned = save.owned.includes(id);
            const active = save.car === id;
            const selectedPaint = paints[save.paint[id]]?.color || car.color;
            return (
              '<article class="tile ' +
              (active ? 'earned' : '') +
              '"><span class="car-preview" aria-hidden="true" style="--car-offset:' +
              index * 50 +
              '%"></span><strong>' +
              car.name +
              '</strong><small><span class="paint-dot" style="background:' +
              selectedPaint +
              '"></span>' +
              car.subtitle +
              '</small>' +
              (owned
                ? button(
                    active ? '当前车辆' : '设为出发车辆',
                    command('select-car') + ' data-id="' + id + '"',
                    active ? 'chosen' : '',
                    active,
                  )
                : '<small>' +
                  (id === 'van' ? '在维修街停车场完成试驾' : '完成「夜班急件」解锁') +
                  '</small>') +
              '</article>'
            );
          })
          .join('') +
        '</div><h3>' +
        cars[save.car].name +
        ' · 涂装</h3><div class="panel-nav">' +
        save.skins
          .filter((id) => paints[id])
          .map((id) =>
            button(
              paints[id].name,
              command('select-paint') + ' data-id="' + id + '"',
              (save.paint[save.car] || 'factory') === id ? 'chosen' : '',
            ),
          )
          .join('') +
        '</div><p>停车场可以试驾厢式车，车库旁可以修复车辆。</p><div class="actions">' +
        button('用当前车辆出发', 'data-start="free"', primary) +
        '</div>'
      );
    },
    armory() {
      const cards = weapons
        .map((weapon, index) => {
          const owned = hasWeapon(save, index);
          const { ammo, stock } = save.arsenal[index];
          const option = ' data-id="' + index + '"';
          const price = save.perks ? '使用补给券' : '补给弹药 · ' + weapon.ammoPrice + ' 潮票';
          return (
            '<article class="tile">' +
            icon(index === 0 ? 'blaster' : 'pulse') +
            '<b>' +
            weapon.name +
            '</b><small>弹匣上限 ' +
            weapon.cap +
            ' 发</small>' +
            (owned
              ? '<small>当前弹匣 ' +
                ammo +
                ' 发 · 备用 ' +
                stock +
                ' 发</small>' +
                button(
                  price,
                  command('buy-ammo') + option,
                  '',
                  stock >= weapon.stock * 3 || (!save.perks && save.coins < weapon.ammoPrice),
                )
              : button(
                  '购买 · ' + weapon.price + ' 潮票',
                  command('buy-weapon') + option,
                  primary,
                  save.coins < weapon.price,
                )) +
            '</article>'
          );
        })
        .join('');
      return (
        '<p class="wallet-panel">钱包 <b>' +
        save.coins +
        ' 潮票</b> · 补给券 ' +
        save.perks +
        ' 张</p><div class="activity-grid">' +
        cards +
        '</div><p>购买的武器附带弹药。也可在训练场领取手枪，命中三个靶牌解锁脉冲发射器。</p><div class="actions">' +
        (play.hidden
          ? button('前往训练场', 'data-start="training"', primary)
          : button('继续游玩', command('resume'), primary)) +
        '</div>'
      );
    },
    districts() {
      return (
        '<div class="activity-grid"><div class="tile"><b>街头追逐</b><small>抢车上路，甩开巡逻车并消星。</small><div class="actions">' +
        button('体验抢车与消星', 'data-start="chase"', primary) +
        '</div></div><div class="tile"><b>维修街对峙</b><small>盐线与锈锚在维修街碰面。靠近后可观察事件。</small><div class="actions">' +
        button('前往帮派事件', 'data-start="gang"', primary) +
        '</div></div></div><canvas class="map-full" width="450" height="450" aria-label="潮汐市全图"></canvas><div class="row-grid">' +
        districts
          .map(
            (district, index) =>
              '<div class="tile"><b style="color:' +
              district.color +
              '">' +
              district.name +
              '</b><small>' +
              ['海堤、棕榈与计时赛', '晚钟车库、训练区与街区事件', '集装箱、岗亭与警戒区'][index] +
              '</small></div>',
          )
          .join('') +
        '</div>'
      );
    },
    help() {
      return '<h3>电脑键鼠</h3><p><kbd>W A S D</kbd> 步行或驾驶　<kbd>E</kbd> 交互、抢车或上下车　<kbd>Shift</kbd> 冲刺　<kbd>空格</kbd> 手刹</p><p>按住鼠标拖动转动镜头，双击画面可请求鼠标锁定。左键或 <kbd>Enter</kbd> 出拳或开火，右键瞄准，<kbd>Q</kbd> 在徒手和已解锁武器间切换，<kbd>R</kbd> 装填。</p><p><kbd>M</kbd> 地图　<kbd>Esc</kbd> 暂停　长按 <kbd>T</kbd> 脱困</p><h3>手机与平板横屏</h3><p>左手摇杆移动或转向，右侧空白区拖动视角。用右下的攻击按钮出拳或开火，靠近街车后点击抢车提示。驾驶时可以同时转向和踩油门。</p><h3>警方通缉</h3><p>粉色标记是巡逻车。脱离游戏内的视野后会进入搜索倒计时，重新被发现会暂停消星。</p>';
    },
    notice() {
      return messages
        .map(
          (line, index) =>
            '<div class="tile"><small>港务广播 · ' + (index + 1) + '</small><b>' + line + '</b></div>',
        )
        .join('');
    },
    more() {
      return (
        '<div class="actions">' +
        [
          ['武器', 'armory'],
          ['街区地图', 'districts'],
          ['通行证', 'pass'],
          ['设置', 'settings'],
          ['操作帮助', 'help'],
          ['素材与致谢', 'credits'],
        ]
          .map(([label, id]) => button(label, go(id)))
          .join('') +
        '</div>'
      );
    },
    settings() {
      const values = save.settings;
      return (
        ['music', 'effects']
          .map(
            (id, index) =>
              '<label class="settings-row">' +
              ['音乐音量', '音效音量'][index] +
              '<input type="range" data-setting="' +
              id +
              '" min="0" max="1" step=".01" value="' +
              values[id] +
              '"><output>' +
              Math.round(values[id] * 100) +
              '%</output></label>',
          )
          .join('') +
        '<label class="settings-row">画质 <select data-setting="graphics">' +
        [
          ['auto', '自动'],
          ['low', '低画质'],
          ['normal', '标准画质'],
        ]
          .map(
            ([id, label]) =>
              '<option value="' +
              id +
              '"' +
              (values.graphics === id ? ' selected' : '') +
              '>' +
              label +
              '</option>',
          )
          .join('') +
        '</select></label><label class="settings-row">镜头震动和活动动效<input type="checkbox" data-setting="movement"' +
        (values.movement ? ' checked' : '') +
        '></label>' +
        button('素材与致谢', go('credits')) +
        (play.hidden ? '' : button('返回暂停菜单', go('pause')))
      );
    },
    credits() {
      return '<p class="credit">Kenney · 城市工业包、道路设施和载具模型 · CC0。使用了部分仓库、集装箱、路灯、护栏和车辆模型。</p><p class="credit">Alex McCulloch · Synth Wave · CC0。游戏使用 36 秒剪辑版。</p><div class="actions"><a href="https://kenney.nl/assets/city-kit-industrial" target="_blank" rel="noreferrer">Kenney 素材</a><a href="https://opengameart.org/content/synth-wave-alex-mcculloch-august-172021" target="_blank" rel="noreferrer">音乐原作</a><a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 授权</a></div>';
    },
    pause() {
      return (
        '<div class="actions">' +
        button('继续游戏', command('resume'), primary) +
        button('全图', go('map')) +
        button('设置', go('settings')) +
        button('操作', go('help')) +
        button('脱困', command('recover')) +
        button('返回大厅', command('lobby')) +
        '</div>'
      );
    },
    map() {
      return (
        '<canvas class="map-full" width="450" height="450" aria-label="潮汐市全图"></canvas><p>青色箭头为当前位置。金色虚线为当前目标路线。</p>' +
        button('继续游戏', command('resume'), primary)
      );
    },
    loading() {
      return '<p id="loading-step">' + text(data.message || '正在启动三维画面') + '</p>';
    },
    error() {
      return (
        '<p class="warning">' +
        text(data.message || '浏览器无法启动三维画面。') +
        '</p><div class="actions">' +
        button('重试', 'data-start="' + text(data.mode || 'free') + '"', primary) +
        button('返回大厅', command('lobby')) +
        '</div>'
      );
    },
    mission() {
      return (
        '<div class="row-grid"><div class="tile"><small>用时</small><b>' +
        displayTime(data.elapsed) +
        '</b></div><div class="tile"><small>重试</small><b>' +
        data.retries +
        ' 次</b></div><div class="tile earned"><small>车库</small><b>' +
        (data.first ? '双门车已解锁' : '双门车已在车库') +
        '</b></div></div><p class="wallet-panel">任务报酬 <b>+' +
        data.reward +
        ' 潮票</b></p><div class="actions">' +
        button('继续自由驾驶', command('resume'), primary) +
        button('重玩任务', 'data-start="mission"') +
        button('查看车库', go('garage')) +
        '</div>'
      );
    },
    race() {
      return (
        '<div class="tile earned"><b>' +
        displayTime(data.elapsed) +
        '</b><small>' +
        (data.best ? '刷新个人最佳' : '个人最佳 ' + displayTime(save.best)) +
        '</small><small>比赛奖金 +' +
        data.reward +
        ' 潮票</small></div><div class="actions">' +
        button('再跑一次', 'data-start="race"', primary) +
        button('返回巡游', command('resume')) +
        '</div>'
      );
    },
    fail() {
      return (
        '<p class="warning">' +
        text(data.reason) +
        '</p><div class="actions">' +
        button(
          data.checkpoint ? '重试检查点' : data.mission ? '重试任务' : '返回车库',
          command('retry'),
          primary,
        ) +
        button('返回大厅', command('lobby')) +
        '</div>'
      );
    },
    hospital() {
      return (
        '<div class="tile hospital-receipt"><strong>' +
        icon('hospital') +
        text(data.reason) +
        '</strong><span>失去全部现金 <b>' +
        text(data.lost) +
        ' 潮票</b></span>' +
        '<span>生命值已恢复 · 当前钱包 0 潮票</span></div><div class="actions">' +
        button('出院继续游玩', command('discharge'), primary) +
        '</div>'
      );
    },
    context() {
      return (
        '<p>浏览器暂停了三维画面。可尝试继续或回到大厅，进度保存在此浏览器。</p><div class="actions">' +
        button('继续游戏', command('resume'), primary) +
        button('返回大厅', command('lobby')) +
        '</div>'
      );
    },
  };
  content.innerHTML = rows[name]?.() || '';
  icons(content);
  if (name === 'register') $('#nickname').value = save.nick;
  const map = content.querySelector('.map-full');
  if (map) {
    if (game && !play.hidden) game.drawMap(map, true);
    else drawMap(map, {}, true);
  }
}

async function launch(mode) {
  if (blocked || loading) return;
  audio.unlock();
  loading = true;
  try {
    open('loading');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!game) {
      const { createGame } = await import('./game.js');
      game = await createGame({
        stage: play,
        touch,
        store,
        audio,
        onLoad(message) {
          if (view === 'loading') {
            details.message = message;
            const step = $('#loading-step');
            if (step) step.textContent = message;
          }
        },
        callbacks: {
          toast,
          panel: open,
          result(type, values) {
            refreshLobby();
            open(type, values);
          },
        },
      });
    }
    play.hidden = false;
    lobby.hidden = true;
    game.view(!blocked);
    loading = false;
    view = '';
    panel.close();
    game.launch(mode);
    rotationState();
    if (blocked) game.view(false);
  } catch (error) {
    console.error(error);
    loading = false;
    play.hidden = true;
    lobby.hidden = false;
    open('error', { mode, message: '三维画面启动失败。请确认浏览器已启用 WebGL 2，再试一次。' });
  }
}

function returnLobby() {
  game?.reset();
  play.hidden = true;
  lobby.hidden = false;
  closePanel(false);
  refreshLobby();
  rotationState();
  $('#free-start').focus({ preventScroll: true });
}

function applyAction(action, id) {
  switch (action) {
    case 'login':
      if (save.id) {
        save.signedIn = true;
        write();
        closePanel();
        toast('欢迎回来，' + save.nick);
      }
      break;
    case 'guest':
      save.signedIn = false;
      write();
      closePanel();
      toast('已以游客身份进入');
      break;
    case 'pack':
      if (claimPack(save, Number(id))) {
        write();
        audio.cue('win');
        open('shop');
        toast('模拟回执 · 实付 0 元，礼包已到账');
      }
      break;
    case 'sign':
      if (claimDay(save)) {
        write();
        audio.cue('win');
        open('sign');
        toast('第 ' + save.dates.length + ' 天奖励已领取');
      }
      break;
    case 'select-car':
      if (cars[id] && save.owned.includes(id)) {
        save.car = id;
        write();
        open('garage');
        toast('已设为出发车辆');
      }
      break;
    case 'select-paint':
      if (paints[id] && save.skins.includes(id)) {
        save.paint[save.car] = id;
        write();
        open('garage');
      }
      break;
    case 'buy-paint':
      if (buyPaint(save, id)) {
        write();
        open('shop');
        toast('已兑换 ' + paints[id].name);
      }
      break;
    case 'buy-weapon':
    case 'buy-ammo': {
      const index = Number(id);
      const acquired = action === 'buy-weapon' ? buyWeapon(save, index) : buyAmmo(save, index);
      if (acquired) {
        write();
        open('armory');
        toast(weapons[index].name + (action === 'buy-weapon' ? '已收入装备' : '弹药已补充'));
      }
      break;
    }
    case 'discharge':
      closePanel(false);
      game?.discharge();
      break;
    case 'resume':
      closePanel();
      audio.unlock();
      break;
    case 'retry':
      closePanel(false);
      game?.retry();
      audio.unlock();
      break;
    case 'recover':
      closePanel(false);
      game?.recover();
      break;
    case 'lobby':
      returnLobby();
      break;
  }
}

function dismissPanel() {
  if (loading) return;
  if (view === 'hospital') applyAction('discharge');
  else if (view === 'fail') applyAction('retry');
  else closePanel();
}

function preventDefault(event) {
  if (event.cancelable) event.preventDefault();
}

for (const name of ['copy', 'cut', 'contextmenu', 'dragstart']) {
  document.addEventListener(name, preventDefault);
}

// Safari sends gesture events in addition to pointer events used by the game.
for (const name of ['gesturestart', 'gesturechange']) {
  document.addEventListener(name, preventDefault, { passive: false });
}
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) preventDefault(event);
  },
  { passive: false },
);

document.addEventListener('click', (event) => {
  if (blocked) return;
  const control = event.target.closest('button');
  if (!control) return;
  audio.unlock();
  const { start, open: destination, action, game: gameAction, id } = control.dataset;
  if (start) void launch(start);
  else if (destination === 'home') closePanel();
  else if (destination) {
    audio.cue('click');
    open(destination, { id });
  } else if (action) applyAction(action, id);
  else if (gameAction) game?.action(gameAction);
  else if (control.hasAttribute('data-panel-close')) dismissPanel();
});

panel.addEventListener('cancel', (event) => {
  event.preventDefault();
  dismissPanel();
});
panel.addEventListener('submit', (event) => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  const options = ['维修街夜班车手', '沿海绕路王', '港区第九号'];
  save.nick =
    $('#nickname').value.trim().slice(0, 16) || options[Math.floor(Math.random() * options.length)];
  save.id ||= 'TD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  save.signedIn = true;
  write();
  closePanel();
  toast('模拟注册完成 · ' + save.nick);
});

panel.addEventListener('input', (event) => {
  const field = event.target;
  const id = field.dataset.setting;
  if (!id) return;
  save.settings[id] =
    field.type === 'range'
      ? Number(field.value)
      : field.type === 'checkbox'
        ? field.checked
        : field.value;
  if (field.type === 'range')
    field.nextElementSibling.textContent = Math.round(field.value * 100) + '%';
  if (id === 'music') audio.settings();
  if (id === 'graphics') game?.resize();
  document.documentElement.classList.toggle('reduce', !save.settings.movement);
  store.write();
});

function background() {
  audio.muteForBackground();
  if (play.hidden || !game || game.paused || loading) return;
  game.pause(true);
  open('pause', {}, true);
}
window.addEventListener('blur', background);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) background();
});
window.addEventListener('resize', rotationState);
screen.orientation?.addEventListener('change', rotationState);
mobilePointer.addEventListener('change', rotationState);
icons();
document.documentElement.classList.toggle('reduce', !save.settings.movement);
refreshLobby();
rotationState();
if (!store.available) toast('本机存储不可用，本次进度只保留到页面关闭。');
setInterval(() => {
  if (save.settings.movement && !document.hidden && !lobby.hidden && !panel.open && !blocked) {
    messageIndex = (messageIndex + 1) % messages.length;
    $('#ticker').textContent = messages[messageIndex];
  }
  if (!lobby.hidden && !panel.open) refreshLobby();
}, 7400);
