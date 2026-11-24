import { chapters, chapterById, chapterUnlocked, welfareRewards } from './story.js';
import { landmarks } from './city-layout.js';
import './style.css';
import { audioSystem } from './audio.js';
import { cars, days, packs, paints, weapons } from './data.js';
import { icons } from './icons.js';
import { drawMap } from './map.js';
import { eateries } from './neighborhood.js';
import {
  buyAmmo,
  buyPaint,
  buyWeapon,
  claimDay,
  claimPack,
  grantWeapon,
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
let classicGame;
let realGame;
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
  $('#profile-label').textContent = save.signedIn && save.id ? save.id : '登录 / 注册';
  $('#vip').textContent = 'VIP ' + save.claimed.length;
  $('#coin-count').textContent = String(save.coins);
  $('#paint-count').textContent = String(save.skins.length);
  $('#mile-count').textContent = (save.meters / 1000).toFixed(1) + ' km';
  $('#equip-count').textContent = String(weapons.filter((_, index) => hasWeapon(save, index)).length);
  const welfareReady = welfareRewards.some(
    (item) => item.ready(save) && !save.welfareClaimed.includes(item.id),
  );
  document
    .querySelectorAll('[data-open="welfare"]')
    .forEach((entry) => entry.classList.toggle('reward-ready', welfareReady));
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
  $('.promo.recharge').classList.toggle('notify', !save.firstSix);
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
        width > height ? '当前窗口太窄。退出分屏或扩大窗口后继续。' : '把设备横过来即可进入S城。';
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
        if (game.inCinematic) game.focusCinematic();
        else if (
          [
            'fail',
            'hospital',
            'mission',
            'chapterDone',
            'dialogue',
            'food',
            'race',
            'context',
          ].includes(view)
        )
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
  delete play.dataset.dialogue;
  if (!play.hidden && continuePlay) game?.pause(false);
  else if (lastFocus && !lastFocus.closest('[hidden]') && document.contains(lastFocus))
    lastFocus.focus({ preventScroll: true });
}

const panelTitles = {
  profile: '港区身份登记',
  register: '注册车手',
  shop: '潮票商城',
  'confirm-pack': '礼包详情',
  membership: '豪华月卡',
  sign: '七日签到',
  welfare: '福利中心',
  firstSix: '首充 6 元',
  tasks: '任务中心',
  dialogue: '剧情对话',
  chapterDone: '章节完成',
  pass: '夜班通行证',
  garage: '晚钟车库',
  armory: '武器商店',
  food: '点单',
  districts: 'S城街区',
  help: '操作说明',
  notice: '港务广播',
  settings: '设置',
  credits: '素材与致谢',
  more: '更多港区服务',
  pause: '游戏已暂停',
  map: 'S城地图',
  loading: '正在进入S城',
  error: '游戏暂时无法进入',
  mission: '夜班急件 · 已交付',
  race: '海堤计时赛 · 完赛',
  fail: '本次行动中断',
  hospital: 'S城医院',
  context: '画面连接中断',
};

function open(name, data = {}, keepFocus = false) {
  if (name === 'confirm-pack' && Number(data.id) === 0) name = 'firstSix';
  if (name === 'hospital') {
    clearTimeout(toastTimer);
    $('#toast').hidden = true;
    panel.querySelector('.panel-toast')?.remove();
  }
  if (name === 'dialogue') {
    clearTimeout(toastTimer);
    $('#toast').hidden = true;
  }
  view = name;
  details = data;
  if (blocked) return;
  if (!panel.open && !keepFocus) lastFocus = document.activeElement;
  if (!play.hidden && game) game.pause(true);
  $('#panel-kicker').textContent =
    name === 'profile' || name === 'register' || name === 'confirm-pack'
      ? '本机演示'
      : 'GTA6-S城风云';
  const heading =
    name === 'dialogue'
      ? data.chapter
      : name === 'food'
        ? eateries.find((shop) => shop.id === data.id)?.name
        : panelTitles[name];
  $('#panel-title').textContent = heading || 'S城';
  panel.classList.toggle('story-dialog', name === 'dialogue');
  play.toggleAttribute('data-dialogue', name === 'dialogue');
  panel.querySelector('[data-panel-close]').hidden = name === 'dialogue';
  renderPanel(name, data);
  if (!panel.open) {
    panel.showModal();
    const focus =
      name === 'dialogue'
        ? content.querySelector('[data-action="dialogue-next"]')
        : panel.querySelector('[data-panel-close]');
    focus.focus({ preventScroll: true });
  }
}
const go = (name) => 'data-open="' + name + '"';
const command = (name) => 'data-action="' + name + '"';
const primary = 'hot';

function landmarkMap() {
  return (
    '<canvas class="map-full" width="520" height="520" aria-label="S城地标地图"></canvas>' +
    '<div class="activity-grid landmarks">' +
    landmarks
      .map(
        ({ id, name, description, color, icon: mark }) =>
          '<article class="tile"><b style="color:' +
          color +
          '">' +
          icon(mark) +
          ' ' +
          name +
          '</b><small>' +
          description +
          '</small>' +
          button('导航到' + name, command('navigate') + ' data-id="' + id + '"') +
          '</article>',
      )
      .join('') +
    '</div>'
  );
}

function renderPanel(name, data) {
  const rows = {
    profile() {
      const greeting = save.id
        ? '<div class="tile"><b>' +
          text(save.nick) +
          '</b><small>本机试玩编号 ' +
          text(save.id) +
          '</small></div>'
        : '<p>登记车手，继续在 S 城活动。昵称和进度保存在此浏览器。</p>';
      return (
        greeting +
        '<div class="actions">' +
        (save.id ? button('登录', command('login'), primary) : '') +
        button(save.id ? '修改试玩昵称' : '注册车手', go('register'), save.id ? '' : primary) +
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
        '</b></p><div class="row-grid">' +
        packs
          .map(
            (pack, index) =>
              '<article class="tile"><small>' +
              (pack.cost ? pack.cost + ' 潮票' : '开服好礼') +
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
                (index === 0 ? save.firstSix : save.claimed.includes(index)) ? '已领取' : '查看礼包',
                go('confirm-pack') + ' data-id="' + index + '"',
                primary,
                index === 0 ? save.firstSix : save.claimed.includes(index),
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
        return '<p>' + pack.name + '已领取。</p>' + button('返回商城', go('shop'));
      return (
        '<div class="tile win"><b>' +
        pack.name +
        '</b><span>' +
        pack.coins +
        ' 潮票和「' +
        paints[pack.paint].name +
        '」涂装</span><small>' +
        (pack.cost ? '兑换需 ' + pack.cost + ' 潮票' : '开服好礼，每位车手限领一次') +
        '</small></div><div class="actions">' +
        button(
          pack.cost ? '兑换礼包' : '领取礼包',
          command('pack') + ' data-id="' + index + '"',
          primary,
          save.coins < pack.cost,
        ) +
        button('返回商城', go('shop')) +
        '</div>'
      );
    },
    firstSix() {
      return (
        '<div class="tile first-offer">' +
        icon('gift') +
        '<h3>首充 6 元 · 金色车手礼包</h3><p>金色涂装、电弧手枪与补给券。已有手枪会获得备用弹药。</p>' +
        '<small>开服福利 · 实付 ¥0 · 每位车手限领一次</small></div>' +
        button(
          save.firstSix ? '已领取首充礼包' : '领取首充礼包',
          command('first-six'),
          primary,
          save.firstSix,
        )
      );
    },
    welfare() {
      return (
        '<p>新手补给、七日签到和剧情达成奖励。</p><div class="activity-grid">' +
        '<article class="tile"><b>七日签到</b><small>已签到 ' +
        save.dates.length +
        ' / 7 天</small>' +
        button('前往签到', go('sign')) +
        '</article><article class="tile"><b>首充 6 元</b><small>' +
        (save.firstSix ? '礼包已领取' : '开服福利可领取') +
        '</small>' +
        button('查看首充', go('firstSix')) +
        '</article></div><div class="row-list">' +
        welfareRewards
          .map((item) => {
            const claimed = save.welfareClaimed.includes(item.id);
            const ready = item.ready(save);
            return (
              '<article class="tile"><div><b>' +
              item.title +
              ' · ' +
              item.payout +
              ' 潮票</b><small>' +
              item.detail +
              '</small></div>' +
              button(
                claimed ? '已领取' : ready ? '领取' + item.title : '未达成',
                command('welfare-reward') + ' data-id="' + item.id + '"',
                ready ? primary : '',
                claimed || !ready,
              ) +
              '</article>'
            );
          })
          .join('') +
        '</div>'
      );
    },
    tasks() {
      return (
        '<div class="chapter-progress"><b>主线 · 内海湾往事</b><span>已通关 ' +
        save.storyCompleted.length +
        ' / ' +
        chapters.length +
        ' 章</span></div><div class="chapter-list">' +
        chapters
          .map((chapter, index) => {
            const done = save.storyCompleted.includes(chapter.id);
            const unlocked = chapterUnlocked(save, chapter.id);
            const resume = save.storyCheckpoint?.id === chapter.id && save.storyCheckpoint.step > 0;
            return (
              '<article class="tile chapter-tile"><div><small class="chapter-area">第 ' +
              (index + 1) +
              ' 章 · ' +
              chapter.area +
              '</small><b>' +
              chapter.title +
              '</b><p>' +
              chapter.summary +
              '</p></div><div><small>首次通关 +' +
              chapter.reward +
              ' 潮票</small>' +
              button(
                unlocked ? (resume ? '继续章节' : done ? '重玩章节' : '开始章节') : '待解锁',
                command('story') +
                  ' data-id="' +
                  chapter.id +
                  '" aria-label="' +
                  (resume ? '继续 ' : done ? '重玩 ' : '开始 ') +
                  chapter.title +
                  '"',
                unlocked && !done ? primary : '',
                !unlocked,
              ) +
              '</div></article>'
            );
          })
          .join('') +
        '</div>'
      );
    },
    dialogue() {
      const [speaker, line] = data.lines[data.index];
      return (
        '<div class="story-line" aria-live="polite">' +
        icon(speaker === '车手' ? 'car' : 'user') +
        '<div><b>' +
        text(speaker) +
        '</b><p>' +
        text(line) +
        '</p></div></div><div class="actions story-actions"><small>' +
        (data.index + 1) +
        ' / ' +
        data.lines.length +
        '</small>' +
        button(
          data.index + 1 < data.lines.length ? '继续对话' : '返回游戏',
          command('dialogue-next'),
          primary,
        ) +
        button('跳过本段', command('dialogue-skip')) +
        '</div>'
      );
    },
    chapterDone() {
      const chapter = chapterById(data.id);
      const next = chapters[chapters.indexOf(chapter) + 1];
      return (
        '<div class="tile"><b>' +
        chapter.title +
        '</b><small>' +
        (data.reward ? '首次通关 +' + data.reward + ' 潮票' : '章节重玩已完成') +
        '</small></div><div class="actions">' +
        (next
          ? button('下一章 · ' + next.title, command('story') + ' data-id="' + next.id + '"', primary)
          : '') +
        button('任务中心', go('tasks')) +
        button('继续自由游戏', command('resume')) +
        '</div>'
      );
    },
    membership() {
      const active = save.membership > Date.now();
      return (
        '<div class="tile"><b>30 天会员权益</b><small>开通后领取 3 张武器补给券。</small>' +
        (active
          ? '<small>有效期至 ' + new Date(save.membership).toLocaleDateString('zh-CN') + '</small>'
          : '<small>开通需 128 潮票</small>') +
        '</div>' +
        button(active ? '已开通' : '开通月卡', command('member'), primary, active || save.coins < 128)
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
        '</div><p>当前会员等级 VIP ' +
        save.claimed.length +
        '。已获得 ' +
        save.skins.length +
        ' 款涂装。</p>'
      );
    },
    garage() {
      const values = Object.entries(cars).filter(([, car]) => !car.noReverse);
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
    food() {
      const shop = eateries.find((entry) => entry.id === data.id);
      if (!shop) return '';
      const health = Math.ceil(game?.health ?? 100);
      return (
        '<div class="food-status"><p>' +
        text(shop.kind) +
        '</p><span>' +
        icon('heart') +
        ' ' +
        health +
        ' / 100</span><span>' +
        icon('coin') +
        ' ' +
        save.coins +
        ' 潮票</span></div>' +
        '<div class="food-menu">' +
        shop.menu
          .map(([name, price, heal], index) => {
            const full = game?.health >= 100;
            const ready = !full && save.coins >= price;
            const label = full ? '生命已满' : save.coins < price ? '潮票不足' : '点一份';
            return (
              '<article class="tile food-item"><div><b>' +
              text(name) +
              '</b><small>' +
              icon('heart') +
              ' 最多恢复 ' +
              heal +
              ' 生命</small></div><div>' +
              '<span>' +
              price +
              ' 潮票</span>' +
              button(
                label,
                command('buy-food') +
                  ' data-id="' +
                  index +
                  '" aria-label="' +
                  text(label + ' · ' + name + ' · ' + price + ' 潮票') +
                  '"',
                ready ? primary : '',
                !ready,
              ) +
              '</div></article>'
            );
          })
          .join('') +
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
        '</div></div></div>' +
        landmarkMap()
      );
    },
    help() {
      return '<h3>电脑键鼠</h3><p><kbd>W A S D</kbd> 步行或驾驶　<kbd>E</kbd> 交互、拾取、抢车或上下车　<kbd>Shift</kbd> 奔跑　<kbd>空格</kbd> 跳跃 / 手刹　<kbd>V</kbd> 切换倒挡</p><p>移动鼠标即可转动镜头，双击画面可锁定鼠标。左键或 <kbd>Enter</kbd> 出拳或开火，右键瞄准，<kbd>Q</kbd> 在徒手和已解锁武器间切换，<kbd>R</kbd> 装填。</p><p><kbd>M</kbd> 地图　<kbd>Esc</kbd> 暂停　长按 <kbd>T</kbd> 脱困</p><h3>手机与平板横屏</h3><p>左手摇杆移动或转向，右侧空白区拖动视角。用右下的攻击按钮出拳或开火，靠近街车后点击抢车提示。驾驶时可以同时转向和踩油门。停稳后切换 D / R。海边可以游泳，轮渡靠岸后按交互上船或下船。排球用攻击键发球和回球。</p><h3>警方通缉</h3><p>粉色标记是巡逻车。脱离游戏内的视野后会进入搜索倒计时，重新被发现会暂停消星。</p>';
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
        button('经典自由模式', 'data-start="free"') +
        [
          ['武器', 'armory'],
          ['车库', 'garage'],
          ['豪华月卡', 'membership'],
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
        '</select></label><label class="settings-row">镜头震动、开场与过场动画<input type="checkbox" data-setting="movement"' +
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
        button('任务中心', go('tasks')) +
        button('设置', go('settings')) +
        button('操作', go('help')) +
        button('脱困', command('recover')) +
        button('返回大厅', command('lobby')) +
        '</div>'
      );
    },
    map() {
      if (game?.real) {
        return '<canvas class="map-full real-map" width="660" height="320" aria-label="内海湾实景地图"></canvas>' +
          '<a class="map-source" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>' +
          '<div class="actions real-places">' +
          game.places.map(({ id, name }) => button(text(name), command('real-place') + ' data-id="' + id + '"')).join('') +
          '</div>' + button('继续巡游', command('resume'), primary);
      }
      return (
        '<p>青色箭头是当前位置，金色虚线是导航路线。碗标记是食店，绿色两轮标记是可骑的电动车。</p>' +
        button('继续游戏', command('resume'), primary) +
        landmarkMap()
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
        button(
          '重试',
          data.mode === 'story'
            ? command('story') + ' data-id="' + chapterById(data.selection)?.id + '"'
            : 'data-start="' + text(data.mode || 'free') + '"',
          primary,
        ) +
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
        button('下一章 · 最后一班轮渡', command('story') + ' data-id="pier"', primary) +
        button('任务中心', go('tasks')) +
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

async function launch(mode, selection) {
  if (blocked || loading) return;
  audio.unlock();
  loading = true;
  try {
    open('loading');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const real = mode === 'real';
    let next = real ? realGame : classicGame;
    if (!next) {
      const create = real
        ? (await import('./real-drive.js')).createRealDrive
        : (await import('./game.js')).createGame;
      next = await create({
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
      if (real) realGame = next;
      else classicGame = next;
    }
    if (game && next !== game) game.reset();
    game = next;
    play.classList.toggle('real-mode', real);
    $('#world').hidden = real;
    $('#real-world').hidden = !real;
    $('#real-mode-switch').hidden = !real;
    $('#real-height-controls').hidden = true;
    play.hidden = false;
    lobby.hidden = true;
    game.view(!blocked);
    loading = false;
    view = '';
    panel.close();
    game.launch(mode, selection);
    if (mode !== 'story' && selection) game.navigate(selection);
    rotationState();
    if (blocked) game.view(false);
  } catch (error) {
    console.error(error);
    loading = false;
    play.hidden = true;
    lobby.hidden = false;
    open('error', {
      mode,
      selection,
      message: '三维画面启动失败。请确认浏览器已启用 WebGL 2，再试一次。',
    });
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
    case 'real-place':
      if (game?.real && view === 'map') {
        game.locate(id);
        closePanel();
      }
      break;
    case 'story':
      if (chapterUnlocked(save, id)) void launch('story', id);
      break;
    case 'buy-food':
      if (view === 'food' && game) {
        const message = game.buyMeal(details.id, Number(id));
        refreshLobby();
        renderPanel('food', details);
        const next =
          content.querySelector('[data-action="buy-food"]:not(:disabled)') ||
          panel.querySelector('[data-panel-close]');
        next.focus({ preventScroll: true });
        toast(message);
      }
      break;
    case 'dialogue-next':
    case 'dialogue-skip': {
      if (view !== 'dialogue') break;
      const current = details;
      if (action === 'dialogue-next' && current.index + 1 < current.lines.length) {
        current.index++;
        renderPanel('dialogue', current);
        content.querySelector('[data-action="dialogue-next"]').focus({ preventScroll: true });
      } else {
        closePanel();
        current.done?.();
      }
      break;
    }
    case 'first-six':
      if (!save.firstSix) {
        save.firstSix = true;
        claimPack(save, 0);
        if (!grantWeapon(save, 0)) {
          save.arsenal[0].stock = Math.min(weapons[0].stock * 3, save.arsenal[0].stock + 24);
        }
        save.perks++;
        write();
        open('firstSix');
        toast('首充礼包已到账');
      }
      break;
    case 'welfare-reward': {
      const reward = welfareRewards.find((item) => item.id === id);
      if (reward?.ready(save) && !save.welfareClaimed.includes(id)) {
        save.welfareClaimed.push(id);
        save.coins += reward.payout;
        write();
        open('welfare');
        toast('已领取 ' + reward.payout + ' 潮票');
      }
      break;
    }
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
        toast('礼包已到账');
      }
      break;
    case 'member':
      if (!(save.membership > Date.now()) && save.coins >= 128) {
        save.coins -= 128;
        save.perks += 3;
        save.membership = Date.now() + 30 * 86_400_000;
        write();
        open('membership');
        toast('月卡权益已到账');
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
  if (view === 'dialogue') return;
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
  } else if (action === 'navigate') {
    if (play.hidden) void launch('free', id);
    else {
      game?.navigate(id);
      closePanel();
    }
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
  toast('注册车手完成 · ' + save.nick);
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
