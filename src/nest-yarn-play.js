export const YARN_PLAY=Object.freeze({flight:1.55,bounce:.28,reach:1.9,contact:2.45,chase:2.85,return:4.95,rest:5.8});
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const cubic=(a,b,c,d,t)=>a*(1-t)**3+3*b*(1-t)**2*t+3*c*(1-t)*t*t+d*t**3;
function between(age,start,end,a,b){return lerp(a,b,smooth((age-start)/(end-start)));}

/** One clock for the falling ball, paw contact and the cat following it. No save mutations. */
export function yarnPlayPose(seconds,{startX=2.25,startY=3.8,landingX=.95,reducedMotion=false}={}) {
  const age=Math.max(0,Number.isFinite(seconds)?seconds:0),t=YARN_PLAY;
  const ball={x:landingX,y:0,z:0,scale:1,rotation:1.8,tailScale:1,shadowScale:1,shadowOpacity:1};
  const cat={phase:'watch',clip:'idle',x:0,y:0,z:0,yaw:0,reach:0,swipe:0,blend:1};
  if(reducedMotion)return {ball:{...ball,rotation:0},cat:{...cat,phase:'rest',blend:0}};
  if(age<t.flight){
    const u=age/t.flight;
    // The reference enters from the upper right, bends down, then turns towards the paws.
    ball.x=cubic(startX,startX-.65,landingX+.7,landingX,u);
    ball.y=cubic(startY,startY,.12,0,u);
    ball.z=-2.8*(1-u);ball.scale=lerp(.44,1,u);ball.rotation=-3.2+5*u;
    ball.tailScale=.2;ball.shadowScale=ball.scale;ball.shadowOpacity=Math.max(.12,1-ball.y/2);
  }else if(age<t.flight+t.bounce){
    const u=(age-t.flight)/t.bounce;ball.y=.12*4*u*(1-u);ball.tailScale=lerp(.2,1,smooth(u));
    ball.shadowScale=1-ball.y*.6;ball.shadowOpacity=1-ball.y*1.4;
  }else if(age>=t.contact){
    ball.x=age<3.3?between(age,t.contact,3.3,landingX,landingX+.6)
      :age<4.15?between(age,3.3,4.15,landingX+.6,landingX-.4)
      :age<4.95?between(age,4.15,4.95,landingX-.4,landingX+.3)
      :between(age,4.95,t.rest,landingX+.3,landingX+.1);
    ball.rotation=1.8-(ball.x-landingX)/.35;
  }
  cat.blend=smooth(age/.35)*(1-smooth((age-t.return)/(t.rest-t.return)));
  if(age<t.reach)cat.yaw=.12*smooth(age/t.flight);
  else if(age<t.chase){
    cat.phase='paw';cat.reach=age<t.contact?smooth((age-t.reach)/(t.contact-t.reach)):1-smooth((age-t.contact)/(t.chase-t.contact));
    cat.swipe=Math.sin(Math.PI*clamp((age-(t.contact-.14))/.35));
    cat.x=.12*cat.reach;cat.y=-.06*cat.reach;cat.yaw=.12+.08*cat.reach;
  }else if(age<t.return){
    cat.phase='chase';cat.clip='run';
    if(age<3.55){cat.x=between(age,t.chase,3.55,0,.48);cat.yaw=between(age,t.chase,3.15,.12,1.05);}
    else if(age<4.35){cat.x=between(age,3.55,4.35,.48,-.1);cat.yaw=between(age,3.55,3.85,1.05,-1.05);}
    else{cat.x=between(age,4.35,t.return,-.1,.16);cat.yaw=between(age,4.35,4.65,-1.05,.85);}
  }else if(age<t.rest){cat.phase='return';cat.clip='walk';cat.x=between(age,t.return,t.rest,.16,0);cat.yaw=between(age,t.return,t.rest,.85,0);}
  else{cat.phase='rest';cat.blend=0;}
  return {ball,cat};
}
