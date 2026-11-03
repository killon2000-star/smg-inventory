# 입고 예정 사진 읽기 시험용 샘플 (정답은 truth.json)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json, random, glob
F=glob.glob('/usr/share/fonts/truetype/sand-box/google/Nanum Gothic/NanumGothic-Regular.ttf')[0]
f=ImageFont.truetype(F,26); fb=ImageFont.truetype(F,26)
H=['상품명','바코드','수량','단가']
R=[('진격의 거인 아크릴 스탠드 리바이','8809912345012',24,15000),('진격의 거인 캔뱃지 세트','8809912345029',60,8000),('주술회전 키링 고죠','8809912345036',36,12000),('하이큐 포토카드 랜덤','8809912345043',120,3000),('귀멸의 칼날 머그컵','8809912345050',12,18000),('원피스 루피 인형 30cm','8809912345067',8,32000)]
truth=[{'name':a,'barcode':b,'qty':c} for a,b,c,_ in R]
def table():
    W=[430,240,110,130]; im=Image.new('RGB',(sum(W)+40,60+50*(len(R)+1)),'white'); d=ImageDraw.Draw(im)
    d.text((20,12),'11월 입고 예정 리스트 (수원점) 2026.11.12',font=fb,fill='black')
    for i,row in enumerate([H]+[(a,b,f'{c:,}',f'{p:,}') for a,b,c,p in R]):
        y=55+i*50; x=20
        if i==0: d.rectangle([20,y,20+sum(W),y+50],fill='#d9e8d0')
        for j,v in enumerate(row):
            d.rectangle([x,y,x+W[j],y+50],outline='#999'); tw=d.textlength(v,font=f)
            d.text((x+W[j]-tw-10 if j>=2 and i else x+10,y+11),v,font=f,fill='black'); x+=W[j]
    return im
t=table(); t.save('s1_table.png')
# 휴대폰으로 찍은 느낌: 확대·기울임·흐림·잡음·그림자
p=t.resize((t.width*2,t.height*2)).rotate(3.5,expand=True,fillcolor=(205,200,190),resample=Image.BICUBIC)
p=p.filter(ImageFilter.GaussianBlur(1.2)); px=p.load(); random.seed(1)
for _ in range(60000):
    x=random.randrange(p.width); y=random.randrange(p.height); v=px[x,y]; n=random.randint(-30,30); px[x,y]=tuple(max(0,min(255,c+n)) for c in v)
sh=Image.linear_gradient('L').resize(p.size).point(lambda v:255-v//4); p=Image.composite(p,Image.new('RGB',p.size,(120,115,105)),sh)
p.convert('RGB').save('s2_photo.jpg',quality=80)
# 카카오톡 메시지
k=Image.new('RGB',(720,520),'#b2c7d9'); d=ImageDraw.Draw(k); d.rounded_rectangle([30,30,690,490],18,fill='#fee500')
msg=['수원점 입고 예정 보내드립니다','']+[f'{a} {c}개' for a,b,c,p in R]
for i,l in enumerate(msg): d.text((55,50+i*48),l,font=f,fill='black')
k.save('s3_kakao.png')
json.dump(truth,open('truth.json','w'),ensure_ascii=False,indent=1)
