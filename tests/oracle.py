"""Independent test oracle: python-json-patch plus separate pointer/contract logic."""
import json,sys,copy
import jsonpatch,jsonpointer

def equal(a,b):
    if type(a) is not type(b):
        return isinstance(a,(int,float)) and not isinstance(a,bool) and isinstance(b,(int,float)) and not isinstance(b,bool) and a==b
    if isinstance(a,dict):return a.keys()==b.keys() and all(equal(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(equal(x,y) for x,y in zip(a,b))
    return a==b

def at(value,path):
    parts=[] if path=='' else path[1:].split('/')
    for raw in parts:
        key=raw.replace('~1','/').replace('~0','~')
        if isinstance(value,list):
            if not key.isascii() or not key.isdigit() or (len(key)>1 and key[0]=='0'):raise KeyError()
            i=int(key)
            if i>=len(value):raise KeyError()
            value=value[i]
        elif isinstance(value,dict) and key in value:value=value[key]
        else:raise KeyError()
    return value

def find(value,path):
    try:return True,at(value,path)
    except (KeyError,IndexError):return False,None

def leaves(v,path=''):
    if not isinstance(v,(dict,list)) or len(v)==0:return [(path,v)]
    items=v.items() if isinstance(v,dict) else enumerate(v)
    return [item for k,value in items for item in leaves(value,path+'/'+str(k).replace('~','~0').replace('/','~1'))]

def contracts(v):
    old,new,expected,rules=v['before'],v['after'],v.get('expected'),v['contracts']
    checks=[]
    for c in rules:
        hasold,before=find(old,c['source']);hasnew,after=find(new,c['source'] if c['kind']=='drop' else c['target'])
        hasref,ref=find(expected,c['target']) if c['kind']=='change' and expected is not None else (False,None)
        good=hasold and ((hasnew and equal(before,after)) if c['kind']=='preserve' else (not hasnew) if c['kind']=='drop' else (hasnew and hasref and equal(after,ref)))
        checks.append(bool(good))
    statuses=[]
    for path,value in leaves(old):
        covered=next(((c,checks[i]) for i,c in enumerate(rules) if c['source']=='' or path==c['source'] or path.startswith(c['source']+'/')),None)
        if covered:
            c,good=covered;status=('preserved' if c['kind']=='preserve' else 'intentional-drop' if c['kind']=='drop' else 'intentional-change') if good else 'contract-failed'
        else:
            found,current=find(new,path);status='same-path-equal' if found and equal(value,current) else 'unreviewed'
        statuses.append(status)
    return {'ok':all(checks) and all(s not in ('contract-failed','unreviewed') for s in statuses),'checks':checks,'statuses':statuses}

def main():
    data=json.load(sys.stdin);results=[]
    for c in data['patches']:
        original=copy.deepcopy(c['doc'])
        try:result={'ok':True,'value':jsonpatch.apply_patch(c['doc'],c['patch'],in_place=False)}
        except (jsonpatch.JsonPatchException,jsonpointer.JsonPointerException,KeyError,IndexError,TypeError,ValueError):result={'ok':False}
        assert equal(original,c['doc'])
        results.append(result)
    print(json.dumps({'version':jsonpatch.__version__,'patches':results,'contracts':[contracts(c) for c in data['contracts']]},ensure_ascii=True,allow_nan=False))
if __name__=='__main__':main()
