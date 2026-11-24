import { chapters, chapterUnlocked } from './story.js';

const destinations = {
  night: ['garage', 'cargo', 'garage'],
  pier: ['north-ferry', 'north-ferry', 'south-ferry'],
  hill: ['mountain', 'hill-light'],
  beacon: ['east', 'buoy', 'east-return'],
  label: ['culture', 'archive-desk'],
  ponds: ['south-ferry', 'south-lookout', 'museum'],
  bridge: ['queshi', 'west-arrival', 'bay-bridge', 'east'],
  air: ['tower-room', 'tower-desk'],
  record: ['hospital', 'hospital-desk'],
  daybreak: ['square', 'culture'],
};

export function cityMissions({ store, points, panel, result, toast, cue }) {
  const labels = {
    进展馆找阿柏: '在海湾文化馆找阿柏',
    把调度单送进观鸟站: '到潮博馆交付调度单',
    沿堤到东北观察点: '往南岸观察点调查',
    进医院大堂见阿海: '在医院入口见阿海',
    进入文化馆交付完整记录: '到文化馆交付完整记录',
  };
  const story = chapters.map((chapter) => {
    const list =
      chapter.id === 'night'
        ? [
            { type: 'talk', label: '找阿岚领取灯控盒', lines: chapter.opening },
            {
              type: 'talk',
              label: '到北岸货场签收',
              lines: [
                ['货场值班员', '灯控盒我收下了。签收单上那枚章，是南岸旧仓库的。'],
                ['车手', '既然货场已经关灯，谁还在等这份单？'],
                ['货场值班员', '把回执带给阿岚。问她最后一班轮渡什么时候开。'],
              ],
            },
            {
              type: 'talk',
              label: '回晚钟车库交付签收单',
              lines: [
                ['阿岚', '带上这张单。明天去人民广场码头问小梁。'],
                ['车手', '先把夜班工钱结了。我还没吃饭。'],
              ],
            },
          ]
        : chapter.steps;
    return {
      ...chapter,
      steps: list.map((step, index) => {
        const target = destinations[chapter.id][index];
        return {
          ...step,
          label: labels[step.label] || step.label,
          target,
          point: points[target],
          radius: step.type === 'drive' ? 21 : 9,
        };
      }),
    };
  });
  let current;
  let pending = false;
  const save = store.data;

  function select(id) {
    if (!chapterUnlocked(save, id)) return false;
    const chapter = story.find((item) => item.id === id);
    if (current?.chapter.id === id) return true;
    const checkpoint = save.storyCheckpoint;
    const index =
      checkpoint?.id === id
        ? Math.max(0, Math.min(chapter.steps.length - 1, checkpoint.step | 0))
        : 0;
    current = { chapter, index };
    pending = false;
    save.storyCheckpoint = { id, step: index };
    store.write();
    toast('已追踪 · ' + chapter.title);
    return true;
  }

  function nextChapter() {
    return story.find(
      (chapter) => !save.storyCompleted.includes(chapter.id) && chapterUnlocked(save, chapter.id),
    );
  }

  function finishStep() {
    const run = current;
    if (!run || pending) return;
    const step = run.chapter.steps[run.index];
    const advance = () => {
      if (current !== run) return;
      pending = false;
      if (++run.index < run.chapter.steps.length) {
        save.storyCheckpoint = { id: run.chapter.id, step: run.index };
        store.write();
        cue('mark');
        return;
      }
      const first = !save.storyCompleted.includes(run.chapter.id);
      if (first) {
        save.storyCompleted.push(run.chapter.id);
        save.coins += run.chapter.reward;
      }
      if (run.chapter.id === 'night') {
        save.done = true;
        if (!save.owned.includes('coupe')) save.owned.push('coupe');
      }
      save.storyCheckpoint = null;
      store.write();
      current = null;
      cue('win');
      result('chapterDone', { id: run.chapter.id, reward: first ? run.chapter.reward : 0 });
    };
    if (step.lines.length) {
      pending = true;
      panel('dialogue', { chapter: run.chapter.title, lines: step.lines, index: 0, done: advance });
    } else advance();
  }

  function near(x, z, step) {
    return step?.point && Math.hypot(step.point[0] - x, step.point[1] - z) < step.radius;
  }

  return {
    select,
    resume() {
      current = null;
      pending = false;
      if (save.storyCheckpoint) select(save.storyCheckpoint.id);
    },
    get step() {
      return current?.chapter.steps[current.index];
    },
    get chapter() {
      return current?.chapter;
    },
    get progress() {
      return current ? [current.index + 1, current.chapter.steps.length] : null;
    },
    get nextChapter() {
      return nextChapter();
    },
    interact(x, z, onFoot) {
      if (!onFoot || pending) return null;
      if (this.step?.type === 'talk' && near(x, z, this.step))
        return { label: this.step.label, icon: 'flag', run: finishStep };
      const next = !current && nextChapter();
      if (next && near(x, z, next.steps[0])) {
        return {
          label: '接任务 · ' + next.title,
          icon: 'flag',
          run() {
            select(next.id);
            if (next.steps[0].type === 'talk') finishStep();
          },
        };
      }
      return null;
    },
    update(x, z, driving, swimming) {
      const step = this.step;
      if (!step || pending || !near(x, z, step)) return;
      if (
        (step.type === 'drive' && driving) ||
        (step.type === 'visit' && !driving) ||
        (step.type === 'swim' && swimming)
      )
        finishStep();
    },
    ferryArrived() {
      if (this.step?.type === 'ferry') finishStep();
    },
  };
}
