const frida = require('frida')
const fs = require('fs')
const config = require('./configurate/config.json')

const current = {
    device: null,
    pid: true,
    script: null
}

main()
  .catch(error => {
    console.error(error.stack)
})

async function main() {
    process.on('SIGTERM', stop)
    process.on('SIGINT', stop)

    const device = await frida.getUsbDevice()
    current.device = device
    device.output.connect(onOutput)
    
    const processes = await device.enumerateProcesses({ scope: 'full' })
    const appPid = getPid(processes, config.appName)
    const package = config.package

    let pid

    if (appPid){
        console.log(`[*] connect() to ${config.appName}`) // console write "Error: Invalid PID" (Frida bug or my bad?)
        pid = appPid
    } else{
        console.log(`[*] spawn() ${package}`)
        pid = await device.spawn(package)
    }
    
    current.pid = pid

    console.log(`[*] attach(${pid})`)
    session = await device.attach(pid)
    session.detached.connect(onDetached)

    const filePath = `./scripts/${config.script}.js`

    let textScript = fs.readFileSync(filePath, { encoding: 'utf-8' })

    console.log(`[*] createScript()`)
    
    let script = await session.createScript(textScript)
    current.script = script
    script.message.connect(onMessage)

    await script.load()

    fs.watchFile(filePath, async (curr, prev) =>{
        console.log('update script')

        await script.unload()
        textScript = fs.readFileSync(filePath, { encoding: 'utf-8' })
        script = await session.createScript(textScript)
        await script.load()
    })

    console.log(`[*] resume(${pid})`)
    await device.resume(pid)
}

function getPid(processes, name){
    for (let i = 0; i < processes.length; i++){
        if (processes[i].name === name){
            return processes[i].pid
        }
    }

    return false
}

async function stop() {
    const { device, script } = current

    if (script !== null){
      script.unload()
      current.script = null
    }

    if (device !== null){
      device.output.disconnect(onOutput)
      current.device = null
    }
}

function onOutput(pid, fd, data){
    if (pid !== current.pid){
        return
    }

    let description

    if (data.length > 0){
        description = '"' + data.toString().replace(/\n/g, '\\n') + '"'
    } else{
        description = '<EOF>'
        console.log(`[*] onOutput(pid=${pid}, fd=${fd}, data=${description})`)
    }
}

function onDetached(reason){
    console.log(`[*] onDetached(reason='${reason}')`)
    current.device.output.disconnect(onOutput)
}

function onMessage(message, data){
    const fileContent = 'onMessage() message: ' + getStringsContent(message) +  '\n' + 'data: ' + JSON.stringify(data)
    fs.writeFileSync('./logs/error.txt', fileContent)
}

const getStringsContent = (message) => {
    let str
    
    for (const key in message) {
      str = str + key + ': ' + message[key] + '\n'
    }

    return str
}