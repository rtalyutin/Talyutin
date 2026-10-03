"""Original RT phone. Blender 5.2 authoring and glTF export; no external assets."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public'/'assets';OUT.mkdir(parents=True,exist_ok=True)
# Regenerate only our authored scene; leave other Blender scenes untouched.
previous=bpy.data.scenes.get('RT Phone / studio')
if previous:
    for obj in list(previous.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.scenes.remove(previous)
scene=bpy.data.scenes.new('RT Phone / studio');bpy.context.window.scene=scene
collection=bpy.data.collections.new('RT Phone / export');scene.collection.children.link(collection)
def material(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    return m
metal=material('Graphite anodised aluminium',(.085,.10,.115),.78,.28)
rim=material('Polished graphite chamfer',(.24,.27,.30),.9,.20)
back=material('Satin graphite ceramic',(.035,.045,.054),.18,.43)
glass=material('Black glass bezel',(.009,.012,.016),.24,.17)
black=material('Recesses and antenna polymer',(.004,.006,.008),.05,.58)
lens=material('Optical blue lens coating',(.018,.055,.092),.65,.14)
flash=material('Warm flash diffuser',(.72,.69,.56),.12,.28)
def link(obj,mat):
    collection.objects.link(obj);obj.data.materials.append(mat);return obj
def outline(w,h,r,n=16):
    points=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for j in range(n+1):
            a=math.radians(start+j*90/n);points.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return points
def rounded(name,w,h,depth,radius,mat,location=(0,0,0),bevel=.025):
    b=min(bevel,depth*.45);levels=[(-depth/2,b),(-depth/2+b,0),(depth/2-b,0),(depth/2,b)]
    verts=[]
    for z,inset in levels:verts.extend((x,y,z) for x,y in outline(w-2*inset,h-2*inset,max(.005,radius-inset)))
    count=len(verts)//4;faces=[tuple(reversed(range(count))),tuple(range(3*count,4*count))]
    for k in range(3):
        for i in range(count):
            j=(i+1)%count;faces.append((k*count+i,k*count+j,(k+1)*count+j,(k+1)*count+i))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=link(bpy.data.objects.new(name,mesh),mat);obj.location=location
    for p in mesh.polygons:p.use_smooth=len(p.vertices)==4
    return obj
def disc(name,radius,depth,mat,location):
    count=48;verts=[]
    for z in [-depth/2,depth/2]:verts.extend((radius*math.cos(i*2*math.pi/count),radius*math.sin(i*2*math.pi/count),z) for i in range(count))
    faces=[tuple(reversed(range(count))),tuple(range(count,2*count))]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=link(bpy.data.objects.new(name,mesh),mat);obj.location=location
    for p in mesh.polygons:p.use_smooth=len(p.vertices)==4
    return obj
chassis=rounded('Chassis',3.6,7.5,.36,.48,metal,bevel=.065)
rounded('Front chamfer',3.56,7.46,.044,.46,rim,(0,0,.174),.012)
rounded('Front glass',3.51,7.41,.026,.435,glass,(0,0,.201),.008)
rounded('Screen',3.33,7.15,.012,.28,black,(0,0,.222),.003)
rounded('Rear ceramic',3.51,7.41,.035,.435,back,(0,0,-.195),.009)
rounded('Camera island',1.53,1.72,.11,.27,metal,(-.79,2.59,-.257),.025)
for i,(x,y) in enumerate([(-1.13,3.03),(-1.13,2.25),(-.39,2.63)],1):
    disc(f'Camera {i} titanium ring',.30,.075,rim,(x,y,-.34))
    disc(f'Camera {i} black seal',.255,.018,black,(x,y,-.382))
    disc(f'Camera {i} optical glass',.216,.012,lens,(x,y,-.396))
    disc(f'Camera {i} pupil',.102,.008,black,(x,y,-.407))
disc('Rear flash',.112,.025,flash,(-.38,3.18,-.323))
disc('Depth sensor',.063,.025,black,(-.38,2.10,-.323))
# All front hardware fits in the bezel, clear of the HTML screen ymax 3.575.
rounded('Earpiece',.50,.035,.018,.017,black,(0,3.643,.225),.003)
disc('Front camera ring',.043,.013,rim,(.37,3.645,.229))
disc('Front camera lens',.030,.015,lens,(.37,3.645,.24))
for name,x,y,h in [('Power key',1.805,.92,.69),('Volume up',-1.805,1.54,.48),('Volume down',-1.805,.91,.48),('Action key',-1.805,2.29,.27)]:
    o=rounded(name,.12,h,.058,.055,rim,(x,y,0),.015);o.rotation_euler[1]=math.pi/2
for x in [-1.803,1.803]:
    for y in [-2.82,2.95]:
        o=rounded('Antenna break',.32,.043,.012,.018,black,(x,y,0),.009);o.rotation_euler[1]=math.pi/2
# Real pockets in the aluminium, with dark inner backs rather than surface stickers.
def recess(cutter):
    if 'BOOLEAN' not in [item.identifier for item in bpy.types.Modifier.bl_rna.properties['type'].enum_items]:
        raise RuntimeError('Boolean modifier unavailable')
    mod=chassis.modifiers.new('Machined recess','BOOLEAN');mod.object=cutter
    for prop,value in [('operation','DIFFERENCE'),('solver','EXACT')]:
        valid=[item.identifier for item in mod.bl_rna.properties[prop].enum_items]
        if value not in valid:raise RuntimeError(f'{prop} {value} unavailable')
        setattr(mod,prop,value)
    bpy.context.view_layer.objects.active=chassis;chassis.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
cut=rounded('USB cutter',.43,.12,.25,.055,black,(0,-3.725,0),.003);cut.rotation_euler[0]=math.pi/2;recess(cut)
o=rounded('USB C recessed port',.40,.10,.012,.045,black,(0,-3.61,0),.003);o.rotation_euler[0]=math.pi/2
for x in [-1.18,-1.00,-.82,-.64,.64,.82,1.00,1.18]:
    cut=disc('Speaker cutter',.032,.16,black,(x,-3.74,0));cut.rotation_euler[0]=math.pi/2;recess(cut)
    o=disc('Speaker aperture',.028,.012,black,(x,-3.67,0));o.rotation_euler[0]=math.pi/2
o=rounded('SIM tray seam',.16,.70,.009,.008,black,(1.802,-1.58,0),.004);o.rotation_euler[1]=math.pi/2
# Pre-rotate for Blender Z-up -> glTF Y-up conversion. Browser front is +Z.
for obj in collection.objects:
    q=obj.rotation_euler.to_quaternion()
    obj.location=Vector((obj.location.x,-obj.location.z,obj.location.y))
    obj.rotation_mode='QUATERNION';obj.rotation_quaternion=Quaternion((1,0,0),math.pi/2) @ q
root=bpy.data.objects.new('RT_Phone',None);collection.objects.link(root)
for obj in list(collection.objects):
    if obj!=root:obj.parent=root
for k,v in dict(width=3.6,height=7.5,screenWidth=3.33,screenHeight=7.15,screenZ=.228,screenRadius=.28).items():root[k]=v
world=bpy.data.worlds.new('RT studio');scene.world=world;world.use_nodes=True
n=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
n.inputs['Color'].default_value=(.18,.20,.24,1);n.inputs['Strength'].default_value=.45
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power
    data.size=size;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large softbox',(4,-6,9),1000,6);area('Rim strip',(-5,2,5),850,5);area('Rear fill',(2,4,5),550,4)
data=bpy.data.cameras.new('Studio camera');cam=bpy.data.objects.new('Studio camera',data);scene.collection.objects.link(cam)
cam.location=(9,-13,10);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
# Camera type is a stable RNA enum; verify ORTHO exists before assignment.
if 'ORTHO' in [i.identifier for i in data.bl_rna.properties['type'].enum_items]:data.type='ORTHO'
data.ortho_scale=10;scene.camera=cam
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.film_transparent=True
bpy.ops.object.select_all(action='DESELECT')
for obj in collection.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root
try:bpy.ops.export_scene.gltf(filepath=str(OUT/'rt-phone.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_cameras=False,export_lights=False)
except TypeError as error:raise RuntimeError(f'GLB export unsupported: {error}')
bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name('rt-phone.blend')))
print(json.dumps(dict(blender=bpy.app.version_string,objects=len(collection.objects),glb_bytes=(OUT/'rt-phone.glb').stat().st_size,original_asset=True,model=dict(root.items()))))
