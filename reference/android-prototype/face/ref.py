# Reference face pipeline (SCRFD det_500m + ArcFace MobileFaceNet w600k_mbf), to port to Kotlin.
import numpy as np, onnxruntime as ort
from PIL import Image
DET=ort.InferenceSession('m/det_500m.onnx'); REC=ort.InferenceSession('m/w600k_mbf.onnx')
REF=np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]],np.float32)
def detect(img):  # img: PIL RGB
    S=640; w,h=img.size; sc=S/max(w,h); nw,nh=int(round(w*sc)),int(round(h*sc))
    canvas=np.zeros((S,S,3),np.float32); canvas[:nh,:nw]=np.asarray(img.resize((nw,nh),Image.BILINEAR),np.float32)
    x=((canvas-127.5)/128.0).transpose(2,0,1)[None]
    outs=DET.run(None,{'input.1':x})
    best=None
    for i,st in enumerate([8,16,32]):
        sc_,bb,kp=outs[i][:,0],outs[i+3]*st,outs[i+6]*st
        g=S//st; ys,xs=np.mgrid[:g,:g]; c=np.stack([xs,ys],-1).reshape(-1,2).astype(np.float32)*st; c=np.repeat(c,2,0)
        j=int(np.argmax(sc_))
        if best is None or sc_[j]>best[0]:
            cx,cy=c[j]; box=[cx-bb[j,0],cy-bb[j,1],cx+bb[j,2],cy+bb[j,3]]
            k=np.stack([cx+kp[j,0::2],cy+kp[j,1::2]],-1)
            best=(float(sc_[j]),np.array(box)/sc,k/sc)
    return best
def similarity(src,dst):  # least-squares similarity transform src->dst (Umeyama, no reflection)
    ms,md=src.mean(0),dst.mean(0); s0,d0=src-ms,dst-md
    a=(s0[:,0]*d0[:,0]+s0[:,1]*d0[:,1]).sum(); b=(s0[:,0]*d0[:,1]-s0[:,1]*d0[:,0]).sum(); n=(s0**2).sum()
    A,B=a/n,b/n  # [[A,-B],[B,A]]
    t=md-np.array([A*ms[0]-B*ms[1],B*ms[0]+A*ms[1]])
    return A,B,t
def align(img,kps):
    A,B,t=similarity(kps,REF)
    # inverse map for PIL affine: output (u,v) -> input
    M=np.array([[A,-B,t[0]],[B,A,t[1]],[0,0,1]]); Mi=np.linalg.inv(M)
    return img.transform((112,112),Image.AFFINE,tuple(Mi[:2].reshape(-1)),Image.BILINEAR)
def embed(face):
    x=((np.asarray(face,np.float32)-127.5)/127.5).transpose(2,0,1)[None]
    e=REC.run(None,{'input.1':x})[0][0]; return e/np.linalg.norm(e)
if __name__=='__main__':
    from skimage import data
    import io
    a=Image.fromarray(data.astronaut()).convert('RGB')
    d=detect(a); print('score',round(d[0],3),'box',d[1].round(1),'kps',d[2].round(1).tolist())
    ea=embed(align(a,d[2]))
    def variant(im):
        b=io.BytesIO(); im.save(b,'JPEG',quality=30); return Image.open(b).convert('RGB')
    small=variant(a.resize((180,180)).convert('L').convert('RGB'))   # like a small grey chip photo
    d2=detect(small); e2=embed(align(small,d2[2])); print('same person, small grey jpeg30:',round(float(ea@e2),3))
    rot=a.rotate(15,expand=True); d3=detect(rot); e3=embed(align(rot,d3[2])); print('same, rotated 15:',round(float(ea@e3),3))
    flip=a.transpose(Image.FLIP_LEFT_RIGHT); d4=detect(flip); print('flip',round(float(ea@embed(align(flip,d4[2]))),3))
    align(a,d[2]).save('aligned.png')
