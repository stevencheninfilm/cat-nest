// Actual alpha bounds of the six generated costume cats, without altering their pixels.
const width=1254,height=1254,padding=4;
const sprite=(name,motion,bounds)=>{
  const [left,top,right,bottom]=bounds;
  const x=left-padding,y=top-padding,w=right-left+padding*2,h=bottom-top+padding*2;
  return Object.freeze({name,motion,texture:'game-cats-v1',ratio:`${w} / ${h}`,portraitWidth:Math.min(1,w/h)*100,
    baseline:(h-padding)/h*100,backgroundSize:`${width/w*100}% ${height/h*100}%`,
    backgroundPosition:`${x/(width-w)*100}% ${y/(height-h)*100}%`});
};
export const GAME_CAT_POSES=Object.freeze([
  sprite('扶着帽子晒太阳','sit',[84,229,386,630]),
  sprite('抱着卡片发呆','sit',[495,282,824,628]),
  sprite('系着围巾静静守望','sit',[903,254,1218,628]),
  sprite('穿着围裙等开饭','sit',[79,689,403,1100]),
  sprite('披着斗篷打盹','loaf',[447,871,806,1095]),
  sprite('舒展爪爪伸懒腰','stretch',[868,773,1231,1099]),
]);

// The two walking frames share dimensions and a paw baseline.
export const GAME_CAT_WALKS=Object.freeze([
  {
    "ratio": "330 / 295",
    "texture": "game-walking-v1",
    "backgroundSize": "310.303030% 520.677966%",
    "a": "3.674352% 8.380338%",
    "b": "3.602305% 64.141821%"
  },
  {
    "ratio": "295 / 253",
    "texture": "game-walking-v1",
    "backgroundSize": "347.118644% 607.114625%",
    "a": "51.303155% 11.535464%",
    "b": "51.440329% 65.315666%"
  },
  {
    "ratio": "296 / 257",
    "texture": "game-walking-v1",
    "backgroundSize": "345.945946% 597.665370%",
    "a": "97.252747% 11.258796%",
    "b": "96.978022% 65.285379%"
  },
  {
    "ratio": "325 / 306",
    "texture": "game-walking-v1",
    "backgroundSize": "315.076923% 501.960784%",
    "a": "3.719599% 33.902439%",
    "b": "3.719599% 91.382114%"
  },
  {
    "ratio": "310 / 231",
    "texture": "game-walking-v1",
    "backgroundSize": "330.322581% 664.935065%",
    "a": "52.170868% 37.854406%",
    "b": "52.661064% 91.570881%"
  },
  {
    "ratio": "307 / 254",
    "texture": "game-walking-v1",
    "backgroundSize": "333.550489% 604.724409%",
    "a": "98.465830% 36.739470%",
    "b": "98.953975% 92.121685%"
  }
].map(Object.freeze));
