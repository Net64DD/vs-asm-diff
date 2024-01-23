function scanComponents(){
    components = []
    const table = document.getElementsByClassName('diff')[0]
    const tbody = table.children[1]

    for(let i = 0; i < tbody.children.length; i++){
        const tr = tbody.children[i]
        // const target = tr.children[0]
        // const previous = tr.children[2]
        const current = tr.children[1]
        if(current.children.length == 0) continue;
        const line = parseInt(current.children[0].innerHTML.replace(/\D+/g, ''));
        if(isNaN(line)) continue;
        components.push({
            line: line,
            element: current
        })
    }
}

function selectLine(line){
    for(component of components){
        if(component.line != line){
            component.element.classList.remove('selected')
        } else {
            component.element.classList.add('selected')
        }
    }
}


window.addEventListener('load', scanComponents)
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'rebuild':
            scanComponents()
            break;
        case 'ping':
            selectLine(message.line)
            break;
    }
});