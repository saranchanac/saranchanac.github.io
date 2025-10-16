const ele = document.getElementById("red");
            ele.innerHTML = "Saranchana";
            let cnt = 0;
            setInterval(() => {
                ele.innerHTML = ++cnt; //Math.random().toFixed(2);
            }, 500)