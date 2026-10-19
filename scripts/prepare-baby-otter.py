"""Run in Blender 4.5 LTS with --disable-autoexec and the purchased .blend.

Creates an anatomical weighted rig, blink shapes and proportion-corrected clips
from prepare-otter-motions.mjs. Source files stay in ignored artifacts/licensed/.
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix

ROOT=Path(__file__).resolve().parent.parent
PRIVATE=ROOT/'artifacts/licensed/baby-otter'
OUTPUT=ROOT/'public/pets/baby-otter-v1'
OUTPUT.mkdir(parents=True,exist_ok=True)
motion=json.loads((PRIVATE/'cat-motion.json').read_text())
obj=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
factor=3/obj.dimensions.z
for v in obj.data.vertices:v.co*=factor
# Keep the silhouette and UVs while lowering mobile vertex processing.
dec=obj.modifiers.new('Mobile silhouette','DECIMATE');dec.ratio=.64
bpy.ops.object.modifier_apply(modifier=dec.name)
obj.name='Baby_Otter';obj.data.name='Baby_Otter_Mobile'
for image in bpy.data.images:
 if image.size[0]>1024:image.scale(1024,1024)

def smooth(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)

# Blender Z-up, front is -Y. The cat's idle frame is the motion reference,
# rather than its T-pose; the otter keeps its seated, shell-holding rest pose.
spec=[
 ('Hips',None,(0,.18,.55),(0,.12,.82)),
 ('Spine_03','Hips',(0,.12,.82),(0,.06,1.08)),
 ('Spine_02','Spine_03',(0,.06,1.08),(0,.02,1.34)),
 ('Spine_01','Spine_02',(0,.02,1.34),(0,.02,1.48)),
 ('Neck','Spine_01',(0,.02,1.48),(0,.01,1.55)),
 ('Head','Neck',(0,.01,1.55),(0,0,2.65)),
]
for side,sign in [('L',1),('R',-1)]:
 spec.extend([
  ('Clavicle_'+side,'Spine_01',(0,.02,1.34),(.60*sign,-.06,1.34)),
  ('Arm_'+side,'Clavicle_'+side,(.60*sign,-.06,1.34),(.78*sign,-.28,1.19)),
  ('Forearm_'+side,'Arm_'+side,(.78*sign,-.28,1.19),(.55*sign,-.52,1.10)),
  ('Hand_'+side,'Forearm_'+side,(.55*sign,-.52,1.10),(.34*sign,-.61,1.10)),
  ('Hind_Leg_'+side,'Hips',(.47*sign,.10,.48),(.70*sign,-.20,.33)),
  ('Lower__Leg_'+side,'Hind_Leg_'+side,(.70*sign,-.20,.33),(.77*sign,-.43,.25)),
  ('Foot_'+side,'Lower__Leg_'+side,(.77*sign,-.43,.25),(.77*sign,-.71,.22)),
 ])
spec.extend([('Tail_01','Hips',(0,.50,.30),(0,.83,.24)),('Tail_07','Tail_01',(0,.83,.24),(0,1.25,.18))])
arm=bpy.data.armatures.new('Otter_Compatible_Rig');rig=bpy.data.objects.new('Otter_Compatible_Rig',arm)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for name,parent,head,tail in spec:
 bone=arm.edit_bones.new(name);bone.head=head;bone.tail=tail
 if parent:bone.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
groups={name:obj.vertex_groups.new(name=name) for name,*_ in spec}

def torso(z):
 stops=[(.55,'Hips'),(.82,'Spine_03'),(1.08,'Spine_02'),(1.30,'Spine_01'),(1.45,'Head')]
 for (a,an),(b,bn) in zip(stops,stops[1:]):
  if z<=b:
   t=smooth(a,b,z);return {an:1-t,bn:t}
 return {'Head':1}

for v in obj.data.vertices:
 x,y,z=v.co;side='L' if x>=0 else 'R';ax=abs(x);weights=torso(z)
 # The front paws and shell share a continuous mesh. Keep the shell on the
 # chest, blend shoulders gently, and move the paws without pulling the head.
 paw=smooth(.34,.66,ax)*smooth(-.02,-.29,y)*(1-smooth(1.42,1.65,z))*smooth(.74,1.0,z)
 foot=smooth(.32,.61,ax)*(1-smooth(.48,.77,z))*(1-smooth(.03,.40,y))
 tail=smooth(.62,.93,y)*(1-smooth(.34,.62,z))
 regions=[(paw,{'Arm_'+side:1-smooth(-.18,-.48,y),'Forearm_'+side:smooth(-.18,-.48,y)*(1-smooth(.70,.43,ax)),'Hand_'+side:smooth(-.18,-.48,y)*smooth(.70,.43,ax)}),
          (foot,{'Lower__Leg_'+side:1-smooth(-.14,-.44,y),'Foot_'+side:smooth(-.14,-.44,y)}),
          (tail,{'Tail_01':1-smooth(.78,1.08,y),'Tail_07':smooth(.78,1.08,y)})]
 for influence,values in regions:
  weights={k:w*(1-influence) for k,w in weights.items()}
  for k,w in values.items():weights[k]=weights.get(k,0)+w*influence
 top=sorted(((k,w) for k,w in weights.items() if w>1e-5),key=lambda item:-item[1])[:4]
 total=sum(w for _,w in top)
 for name,w in top:groups[name].add([v.index],w/total,'REPLACE')
modifier=obj.modifiers.new('Compatible skin','ARMATURE');modifier.object=rig;obj.parent=rig
obj.shape_key_add(name='Basis')
for side,sign in [('L',1),('R',-1)]:
 key=obj.shape_key_add(name='Blink_'+side)
 for v,p in zip(obj.data.vertices,key.data):
  # Smooth lid deformation over the embedded eye; never swap cat face maps.
  dx=(v.co.x-.52*sign)/.26;dz=(v.co.z-2.15)/.25
  influence=(1-smooth(.78,1.17,math.sqrt(dx*dx+dz*dz)))*(1-smooth(-.53,-.40,v.co.y))
  p.co.z-= (v.co.z-2.15)*.97*influence
  p.co.y+=.06*influence

convert=Quaternion((1,0,0),math.pi/2)
def source_q(values):return Quaternion((values[3],values[0],values[1],values[2]))
refs={name:source_q(motion['reference'][name]['q']) for name,*_ in spec}
rest_world={b.name:b.matrix_local.to_quaternion() for b in arm.bones}
rest_local={b.name:(b.parent.matrix_local.inverted()@b.matrix_local).to_quaternion() if b.parent else b.matrix_local.to_quaternion() for b in arm.bones}
scene=bpy.context.scene;scene.render.fps=24
rig.animation_data_create();clips=[]
for clip in motion['clips']:
 action=bpy.data.actions.new(clip['name']);action.use_fake_user=True;rig.animation_data.action=action
 previous={}
 for frame in clip['frames']:
  number=frame['time']*24;world={}
  for name,parent,*_ in spec:
   source=source_q(frame['joints'][name]['q'])
   delta=convert@(source@refs[name].inverted())@convert.inverted()
   gain=.62 if name in ['Head','Neck'] else .50 if any(k in name for k in ['Arm','Hand','Leg','Foot','Tail','Clavicle']) else .7
   delta=Quaternion().slerp(delta,gain)
   world[name]=delta@rest_world[name]
   local=world[parent].inverted()@world[name] if parent else world[name]
   rotation=rest_local[name].inverted()@local
   if name in previous and rotation.dot(previous[name])<0:rotation.negate()
   previous[name]=rotation.copy();bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION';bone.rotation_quaternion=rotation
   bone.keyframe_insert(data_path='rotation_quaternion',frame=number,group=name)
  # Only root travel is transferred, at the otter's scale. Limb lengths remain
  # anatomical; copying the cat's translation tracks would stretch this mesh.
  change=Vector(frame['joints']['Hips']['p'])-Vector(motion['reference']['Hips']['p'])
  change=convert@change*.35
  change.x=max(-.12,min(.12,change.x));change.y=max(-.12,min(.12,change.y));change.z=max(-.16,min(.20,change.z))
  root=rig.pose.bones['Hips'];root.location=rest_world['Hips'].inverted()@change
  root.keyframe_insert(data_path='location',frame=number,group='Hips')
 clips.append({'name':clip['name'],'seconds':clip['duration']})
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Idle')
scene.frame_set(0);scene.frame_start=0;scene.frame_end=56
bpy.ops.wm.save_as_mainfile(filepath=str(PRIVATE/'processed/baby-otter-rigged.blend'))
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'model.glb'),export_format='GLB',use_selection=True,
 export_image_format='WEBP',export_image_quality=90,export_animations=True,export_animation_mode='ACTIONS',
 export_force_sampling=True,export_skins=True,export_morph=True,export_yup=True,
 export_copyright='Glossy Studio / Nekueda motions. Licensed assets incorporated into Cat Nest; no standalone redistribution.')
report={'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'bones':len(arm.bones),'clips':clips,'shapes':['Blink_L','Blink_R'],'source':'https://www.fab.com/listings/633458db-ec38-4a5e-98b1-264bd90acad9'}
(PRIVATE/'conversion-report.json').write_text(json.dumps(report,indent=2))
print('OTTER_PREPARED',json.dumps(report))
