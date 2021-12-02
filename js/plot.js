import {colors} from './color.js';

export default class Plot {
  plot;
  plot_id;
  background_selector;
  trajectory_selector;
  annotation_selector;
  gene_selector;
  legend_toggle;
  detail = "annotation";
  traces = [];
  colors = {};

  constructor(plot_id, background_id, trajectory_id, annotation_id, gene_id, legend_id) {
    this.plot_id = plot_id;
    this.background_selector = document.getElementById(background_id);
    this.trajectory_selector = document.getElementById(trajectory_id);
    this.annotation_selector = document.getElementById(annotation_id);
    this.gene_selector = document.getElementById(gene_id);
    this.legend_toggle = document.getElementById(legend_id);
    this.colors = colors;
    console.log('finished construction');
  }

  get plot_id() {
    return this.plot_id;
  }

  get plot() {
    return this.plot;
  }

  async create_plot() {
    console.log('creating plot');
    let traces = await this.#generate_traces();

    let layout = {
      height: 600,
      margin: {l:0 ,r:0, b:0, t:0},
      legend: {yanchor:"top", y:0.9, xanchor:"right", x:0.99}
    };

    Plotly.newPlot(this.plot_id, traces, layout, {responsive: true}).then(() => {
      console.log('finished creating plot');
      this.plot = document.getElementById(this.plot_id);
      this.#add_listeners();
      this.#add_legend_toggle();
    });
  }

  async update_plot() {
    console.log('updating');
    let old_traces_length = this.traces.length;
    await this.#generate_traces();
    Plotly.deleteTraces(this.plot_id, [...Array(old_traces_length).keys()]);
    Plotly.addTraces(this.plot_id, [...this.traces]);
  }

  async #generate_traces() {
    let data = await this.#fetch_data();
    let filtered_data = [];
    let traces = [];
    let annotation = this.annotation_selector.value;
    let unique = [];
    let color = [];
    
    console.log(data);

    if (this.detail == "gene") {
      unique = ['expression'];
    } else if (annotation == 'total_mRNA') {
      unique = ['total_mRNA'];
    } else {
      unique = [...new Set(this.#unpack(data, annotation))];
    }

    console.log(data);

    for (let item in unique){
      if (annotation != 'total_mRNA' & this.detail != 'gene') {
        filtered_data = data.filter((el) => el[annotation] == unique[item]);
        color = this.colors[unique[item]];

      } else {
        filtered_data = data;
        color = this.#unpack(filtered_data, unique[item]);
      }

      let trace = {
          name: unique[item],
          x: this.#unpack(filtered_data, 'x'), y: this.#unpack(filtered_data, 'y'), z: this.#unpack(filtered_data, 'z'),
          mode: 'markers',
          marker: {
            size: 3,
            color: color,
            width: 0.1,
            opacity: 0.4},
          type: 'scatter3d',
          hovertemplate: "Trace"
        };
      traces.push(trace);
    }
    this.traces = traces;
    console.log(traces);
    return traces;
  }

  async #fetch_data() {
    let params = {
      "background": this.background_selector.value,
      "trajectory": this.trajectory_selector.value
    }

    if (this.detail == 'annotation') {
      params[this.detail] = this.annotation_selector.value
    } else if (this.detail == 'gene') {
      params[this.detail] = this.gene_selector.value
    }

    try {
      let res = await fetch('/data?' + new URLSearchParams(params));
      return await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  #add_listeners() {
    this.background_selector.onchange = () => this.update_plot(this.detail);

    this.annotation_selector.onchange = () => {
      this.detail = "annotation";
      this.update_plot();
    };
    this.gene_selector.onchange = () => {
      this.detail = "gene";
      this.update_plot();
    };
  }

  #add_legend_toggle() {
    this.legend_toggle.addEventListener('change', () => {
      if (this.legend_toggle.checked) {
        Plotly.relayout(this.plot_id, {'showlegend': true})
      } else if (!this.legend_toggle.checked) {
        Plotly.relayout(this.plot_id, {'showlegend': false})
      }
    });
  }

  #unpack(data, key) {return data.map(row => row[key])}

  static sync_camera(Plot_1, Plot_2) {
    let cameraChange = false;

    Plot_1.plot.on('plotly_relayout', () => {
      if(!cameraChange) {
        Plotly.relayout(Plot_2.plot, {'scene.camera': Plot_1.plot.layout.scene.camera})
          .then(() => {cameraChange = false});
      }
      cameraChange = true;
    });
  }
}