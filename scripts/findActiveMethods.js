Java.perform(function (){[
        'com.example.myapplication.class'
    ].forEach(traceClass)})

function traceClass(targetClass){
    let hook

    try {
        hook = Java.use(targetClass)
    } catch (error){
        return console.error('hook class failed', error.stack)
    }

    const methods = hook.class.getDeclaredMethods()
    hook.$dispose()
    
    const unicMethods = new Set()

    methods.forEach(function (method) {
        const methodStr = method.toString()
        const methodReplace = methodStr.replace(targetClass + ".", "TOKEN").match(/\sTOKEN(.*)\(/)[1]
        unicMethods.add(methodReplace)
    })

    unicMethods.forEach(targetMethod => {
        traceMethod(targetClass + '.' + targetMethod)
    })
}

function traceMethod(targetClassMethod){
    const delim = targetClassMethod.lastIndexOf('.')

    if (delim === -1){
        return
    }

    const targetClass = targetClassMethod.slice(0, delim)
    const targetMethod = targetClassMethod.slice(delim + 1, targetClassMethod.length)

    const hook = Java.use(targetClass)
    const overloads = hook[targetMethod].overloads
    
    for (let i = 0; i < overloads.length; i++) {
        hook[targetMethod].overloads[i].implementation = function (){
            let arg,
                args = []
            for (let j = 0; j < arguments.length; j++){
                if (j === 0 && arguments[j]){
                    if (arguments[j].toString() === '[object Object]'){
                        let s = []

                        for (let k = 0, l = arguments[j].length; k < l; k++){
                            s.push(arguments[j][k])
                        }

                        arg = s.join('')
                    }

                    args.push({ i: j, o: arg, s: arg ? arg.toString(): 'null'})
                }
            }

            let result

            try {
                result = this[targetMethod].apply(this, arguments)

                console.log('method = ' + targetClass + '.' + targetMethod)
                console.log('args = ' + JSON.stringify(args))
                console.log(`result = { val: ${result} str: ${result ? result.toString() : null} }\n`)
            } catch (error){
                console.error(error.stack)
            }

            return result
        }
    }
}