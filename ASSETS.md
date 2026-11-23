# 《潮线夜驶》素材选型与授权

首版候选已核对发布页上的授权标注。场景采用统一的风格化低多边形模型，用紫粉暮光、潮湿路面、棕榈和工业照明让三个街区看起来属于同一座海滨城市。大厅主视觉由本项目的场景和车辆另行构图。

## 场景、角色与道具

| 用途 | 候选及选用方式 | 授权 | 来源 |
| --- | --- | --- | --- |
| 滨海大道与维修街 | 用 City Kit 的道路、人行道和街道道具拼主干道。用商用建筑包给维修街和海滨一楼门面做变化。 | CC0 | [Kenney City Kit Roads](https://kenney.nl/assets/city-kit-roads)、[Kenney City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) |
| 港区与仓库 | 工业包提供仓库与厂房，货场堆箱单独选用 Quaternius 的集装箱。少量堆箱换色，起重机、岗亭和场景招牌按原创方案组合。 | CC0 | [Kenney City Kit Industrial](https://kenney.nl/assets/city-kit-industrial)、[Quaternius Shipping Container](https://poly.pizza/m/dQXRtm5GbO) |
| 海堤棕榈 | 选同一棵棕榈做尺寸、转向变化，统一批量渲染。 | CC0 | [Quaternius Palm Tree](https://poly.pizza/m/DsrrAYmucG) |
| 路面与墙面 | 从沥青和混凝土各取一套基础贴图，裁减通道和分辨率，雨后质感由材质粗糙度和场景灯光控制。 | CC0 | [Poly Haven Clean Asphalt](https://polyhaven.com/a/clean_asphalt)、[Poly Haven Concrete](https://polyhaven.com/a/concrete) |
| 驾驶和背景车辆 | 从 Cars Pack 选接近轿车、厢式车、双门车的造型，巡逻车复用车身和独立涂装。车辆统一缩放、校正轮轴并导出 GLB。 | CC0 | [Quaternius Cars Pack](https://quaternius.com/packs/cars.html) |
| 玩家、路人和帮派 | 复用角色骨架与步行动画，衣服、配色和姿态区分路人和两组帮派成员。 | CC0 | [Quaternius Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) |
| 虚构武器与训练道具 | 选两种不同剪影的科幻发射器和一个练习靶，重配项目材质。 | CC0 | [Kenney Blaster Kit](https://kenney.nl/assets/blaster-kit?part=f00a6a26-ed05-4d63-8822-29b467bcb2a7) |

## 音乐与音效

| 用途 | 候选及选用方式 | 授权 | 来源 |
| --- | --- | --- | --- |
| 大厅与滨海巡游 | Alex McCulloch 的 Synth Wave，作者标为可循环。先从原曲选一段剪成短循环，按作者请求署名。 | CC0 | [Alex McCulloch · Synth Wave](https://opengameart.org/content/synth-wave-alex-mcculloch-august-172021) |
| 竞速与追逐 | DOS-88 的 Race to Mars 用作节奏更快的备选。作者提供单曲下载，原始 MP3 标为 9.3 MB，发布版采用短循环并标记剪辑。 | CC BY 4.0 | [DOS-88 Synthwave Music Library](https://dos88.itch.io/dos-88-music-library) |
| 车辆音效 | Beetlemuse 的 Car Go Fast! 用作短加速声，源文件约 8 秒、750 KB。持续引擎声使用短循环，随游戏内车速调整响度和音高。 | CC0 | [Beetlemuse · Car Go Fast!](https://freesound.org/people/Beetlemuse/sounds/678961/) |
| 模拟商城、碰撞和武器 | 挑选少量界面确认音、碰撞声和科幻音效，复用同一组声音。 | CC0 | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds)、[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)、[Kenney Digital Audio](https://kenney.nl/assets/digital-audio) |

## 发布规格

- 首次进入大厅优先加载界面和压缩后的原创主视觉。3D 场景按街区分批加载，当前街区先保证碰撞、可交互车辆和玩家可用。此后在玩家接近街区边界之前加载相邻街区，车库预览、额外涂装和音乐分开加载。
- 道路、仓库、箱体、棕榈和路灯复用网格及材质，重复物件合批。远景减少模型细节。手机端采用低分辨率贴图图集、烘焙阴影及简化的积水反光，减少远处居民的动画更新。美术、物理和 NPC 数量在同一条驾驶路线中一起验证。
- 音乐候选以 25–40 秒为循环剪辑目标，单曲发布文件预算 600 KB。引擎、按钮、碰撞等用压缩后的短音频。大厅可先响应点击，音乐随玩家首次操作启用。保留引擎、转向和警戒等关键声效的辨识度。
- 首版预算为大厅累计 800 KB，首次可操作 3D 场景累计 6 MB（移动端）或 8 MB（桌面）。这些数值是发布目标。上表给出的源文件大小来自发布页，转换后的体积、画面和帧率留到导入时实测。

## 素材记录

- 优先选允许商用、修改和随网页分发的素材。CC0 素材按作者记录来路。CC BY 4.0 作品在游戏致谢与素材清单中列出曲名、作者、原始链接、授权链接和剪辑变更。[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans)
- 导入时按实际文件保存来源页面、包版本、许可文本及修改记录。界面、车辆与配乐采用有明确来源的素材和原创内容。

## 已随试玩版发布

| 文件 | 作者及变更 | 来源 |
| --- | --- | --- |
| `public/media/models/` 中的车辆、仓库、集装箱、路灯、护栏和调色板 | Kenney，CC0。选用 Car Kit 3.1、City Kit Industrial 2.0 和 City Kit Roads 中的部分 GLB。调色板分包命名并修改对应模型的贴图路径，许可文本随模型分发。 | [Car Kit](https://opengameart.org/content/car-kit)、[City Kit Industrial](https://opengameart.org/comment/113019)、[City Kit Roads](https://kenney.nl/assets/city-kit-roads) |
| `public/media/synth-wave.mp3` | Alex McCulloch，CC0。取原曲 00:11 起的 36 秒，加淡入淡出，以 96 kbps 发布。 | [Synth Wave](https://opengameart.org/content/synth-wave-alex-mcculloch-august-172021) |
| `public/media/harbor.webp`、`public/media/garage.webp`、`public/media/icon.png` | 大厅封面和车库预览由本作海滨场景和车模渲染，站点图标截取自车库预览。 | [素材渲染页面](scripts/poster.html) |
| `public/media/shantou-bay.webp` | 从游戏内的内海湾场景渲染的新大厅封面。模型、地标和布局采用游戏中的抽象化设计。 | [封面渲染页面](scripts/poster.html) |
| `public/media/shantou-lobby.webp` | 游戏内人民广场、跨湾大桥、原创车手角色和车模渲染。 | [封面渲染页面](scripts/poster.html?lobby) |
